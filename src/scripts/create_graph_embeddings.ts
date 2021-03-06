"use strict";
import {embeddingsTargetsAreValid} from "../utils/embeddings_target";

const queues = require("@arangodb/foxx/queues");
import {GenerationJobInputArgs} from "../utils/generation_job_input_args";
import {aql, db, query} from "@arangodb";
import Collection = ArangoDB.Collection;
import {GraphInput, InvocationOutput, ModelMetadata} from "../model/model_metadata";
import {logErr, logMsg} from "../utils/logging";
import {getEmbeddingsStatus, updateEmbeddingsStatus} from "../services/emb_status_service";
import {EmbeddingsStatus} from "../model/embeddings_status";
import {transposeMatrix} from "../utils/math";
import {chunkArray, invokeEmbeddingModel} from "../utils/invocation";
import {context} from "@arangodb/locals";
import {
    flattenTraversalResult,
    insertGraphEmbeddingsIntoDBSameCollection, insertGraphEmbeddingsIntoDBSepCollection,
    TraversalResult
} from "../script_functions/graph_embeddings";
import {profileCall} from "../utils/profiling";
import {EMB_QUEUE_NAME} from "../utils/embeddings_queue";
import {queueBatch, ScriptName} from "../services/emb_generation_service";

const {argv} = module.context;

let failures = 0;
const FAILURE_THRESHOLD = 25;

const {batchIndex, batchSize, batchOffset, numberOfBatches, collectionName, destinationCollection, graphName, modelMetadata, fieldName, embeddingsRunColName, separateCollection}: GenerationJobInputArgs = argv[0];
const isLastBatch = (batchIndex >= (numberOfBatches - 1));

logMsg(`Create graph/traversal based embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} 
in graph ${graphName} using ${modelMetadata.name} on the ${fieldName} field`);

function getTargetDocumentIds(nDocs: number, startInd: number, docCollection: Collection, embeddingsRunCol: Collection, fieldToEmbed: string): any[] {
    return query`
        FOR embRunDoc in ${embeddingsRunCol}
            LIMIT ${startInd}, ${nDocs}
            FOR doc in ${docCollection}
                FILTER embRunDoc._key == doc._key
                FILTER doc.${fieldToEmbed} != null
                RETURN {
                  "_key": doc._key,
                }
    `.toArray();
}

function buildSubQuery(currentDepth: number, maxDepth: number, sampleSizes: number[], graphName: string, docCollection: Collection): string {
    if (maxDepth > 5) {
        logErr("max hops > 5 is currently unsupported.");
        throw Error("max hops > 5 is currently unsupported.");
    }
    // get an ASCII repr - a is reserved for root query!
    const currentChar = String.fromCharCode(98 + currentDepth);
    const prevChar = String.fromCharCode(98 + currentDepth - 1);
    if (currentDepth == maxDepth) {
        return `
            FOR ${currentChar} IN 1 ANY ${prevChar} GRAPH ${graphName}
                SORT RAND()
                LIMIT ${sampleSizes[currentDepth]}
                RETURN {
                    "node": {
                        "_key": ${currentChar}._key,
                        "field": ${currentChar}.${fieldName}
                    }
                }
        `;
    } else {
        return `
            FOR ${currentChar} IN 1 ANY ${prevChar} GRAPH ${graphName}
                SORT RAND()
                LIMIT ${sampleSizes[currentDepth]}
                LET nh = (${buildSubQuery(currentDepth + 1, maxDepth, sampleSizes, graphName, docCollection)})
                RETURN {
                    "node": {
                        "_key": ${currentChar}._key,
                        "field": ${currentChar}.${fieldName}
                    },
                    "neighbors": nh
                }
        `
    }
}


function buildGraphQuery(graphInput: GraphInput, graphName: string, targetDocs: any[], docCollection: Collection) {
    const subQuery = buildSubQuery(0, graphInput.neighborhood.number_of_hops - 1, graphInput.neighborhood.samples_per_hop, graphName, docCollection);
    return aql`
        FOR doc in ${targetDocs}
        FOR a IN ${docCollection} 
            FILTER a._key == doc._key
            LET nh = (
                ${aql.literal(subQuery)}
            )
            RETURN {
                "node": {
                    "_key": a._key,
                    "field": a.${fieldName}
                },
                "neighbors": nh
            }
    `;
}

function padFeaturesMatrix(featuresMatrix: any[], expected_size: number) {
    // For a feature matrix, pad with zeros
    if (featuresMatrix.length > 0) {
        if (featuresMatrix.length > expected_size) {
            // return featuresMatrix.slice(0, expected_size);
            throw RangeError(`Features matrix is greater than the model's expected max size! Got: ${featuresMatrix.length}, expected ${expected_size}`);
        }
        const newFeatMat = JSON.parse(JSON.stringify(featuresMatrix)); // start w/ a deep copy
        // Grab first size and pad
        const size_to_pad = newFeatMat[0].length;
        for (let x = 0; x < expected_size - featuresMatrix.length; x++) {
            newFeatMat.push(Array(size_to_pad).fill(0));
        }
        return newFeatMat;
    } else {
        // nothing to pad
        return featuresMatrix;
    }
}

function createAdjacencySizes(adj_lists: number[][][], startIndex: number = 0) {
    const isForwardMap = (startIndex == 0);

    return adj_lists.map((adj_list, i) => {
        if (i == startIndex) {
            return [adj_list.length, 1];
        }
        if (isForwardMap) {
            return [adj_list.length, adj_lists[i - 1].length];
        }
        return [adj_list.length, adj_lists[i + 1].length];
    });
}

function formatGraphInputs(features: any[][], adj_lists: number[][][], graphInput: GraphInput) {
    // TODO: Make this generalize across N > 1 batches!!
    // Now put it all together
    const inputList = [];

    const paddedFeatures = padFeaturesMatrix(features, 1000);

    inputList.push({
        name: graphInput.features_input_key,
        data: paddedFeatures,
        shape: [paddedFeatures.length, paddedFeatures[0].length],
        datatype: "FP32"
    });

    for (let i = 0; i < graphInput.adjacency_list_input_keys.length; i++) {
        const createNewInputKeysObject = () => {
            if (i < adj_lists.length) {
                return {
                    name: graphInput.adjacency_list_input_keys[i],
                    data: transposeMatrix(adj_lists[i]),
                    shape: [2, adj_lists[i].length],
                    datatype: "INT64"
                };
            } else {
                return {
                    name: graphInput.adjacency_list_input_keys[i],
                    data: [],
                    shape: [2, 0],
                    datatype: "INT64"
                };
            }
        };
        const newInputKeysObject = createNewInputKeysObject();
        inputList.push(newInputKeysObject);
    }

    const adjacencySizes = createAdjacencySizes(adj_lists);

    for (let i = 0; i < graphInput.adjacency_size_input_keys.length; i++) {
        const createNewSizeObject = () => {
            if (i < adjacencySizes.length) {
                return {
                    name: graphInput.adjacency_size_input_keys[i],
                    data: adjacencySizes[i],
                    shape: [2],
                    datatype: "INT64"
                };
            } else {
                return {
                    name: graphInput.adjacency_size_input_keys[i],
                    data: [0, 0],
                    shape: [2],
                    datatype: "INT64"
                };
            }
        };
        const newSizeObject = createNewSizeObject();
        inputList.push(newSizeObject);
    }

    return {
        inputs: inputList
    };
}

function getTargetEmbedding(graphInput: GraphInput) {
    return (flattenedTraversal: { features: any[]; adj_lists: number[][][] }) => {
        const requestBody = formatGraphInputs(flattenedTraversal.features, flattenedTraversal.adj_lists, graphInput);
        return invokeEmbeddingModel(requestBody, context.configuration.embeddingService, modelMetadata.invocation.invocation_name);
    }
}

function extractEmbeddingsFromResponse(response_json: any, embedding_dim: number, invocationOutput: InvocationOutput) {
    const output = JSON.parse(response_json);
    const result = output["outputs"]
        .filter((e: any) => e["name"] === invocationOutput.output_key)
        .map((e: any) => {
            const embeddings = chunkArray(e["data"], embedding_dim);
            if (invocationOutput.index !== undefined) {
                return embeddings[invocationOutput.index];
            };
            throw Error("Graph Embeddings require index to be defined");
        });
    return result[0];
}

function getAndSaveGraphEmbeddingsForMiniBatch(docCollection: Collection, dCollection: Collection, input: GraphInput) {
    return function (miniBatch: TraversalResult[]) {
        const flattened = miniBatch.map(res => flattenTraversalResult(res, input.neighborhood.number_of_hops));

        // Foreach because of model only supporting batch size of 1 right now
        flattened.forEach((flatArr, i) => {
            const res = profileCall(getTargetEmbedding(input))(flatArr);
            if (res.status === 200) {
                const embedding = profileCall(extractEmbeddingsFromResponse)(res.body, modelMetadata.invocation.emb_dim, modelMetadata.invocation.output);
                if (separateCollection) {
                    profileCall(insertGraphEmbeddingsIntoDBSepCollection)([miniBatch[i]], [embedding], fieldName, dCollection, modelMetadata);
                } else {
                    profileCall(insertGraphEmbeddingsIntoDBSameCollection)([miniBatch[i]], [embedding], fieldName, docCollection, modelMetadata);
                }
            } else {
                failures++;
                logErr(res);
                logErr("Failed to get requested embedding for minibatch!")
            }
        });
    };
}

function handleFailure(currentBatchFailed: boolean, isTheLastBatch: boolean, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): void {
    if (currentBatchFailed) {
        updateEmbeddingsStatus(EmbeddingsStatus.RUNNING_FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
    }

    if (isTheLastBatch) {
        updateEmbeddingsStatus(EmbeddingsStatus.FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
    }
}

function checkIfBatchFailed(): Boolean {
    return failures >= FAILURE_THRESHOLD;
}

function createGraphEmbeddings() {
    const docCollection = db._collection(collectionName);
    const dCollection = db._collection(destinationCollection);
    const embeddingsRunCol = db._collection(embeddingsRunColName);
    const targetIds = getTargetDocumentIds(batchSize, batchOffset, docCollection, embeddingsRunCol, fieldName);

    try {
        if (modelMetadata.invocation.input.kind == "graph") {
            const graphInput: GraphInput = modelMetadata.invocation.input;
            chunkArray(targetIds, modelMetadata.invocation.inference_batch_size)
                .forEach((chunk) => {
                    if (checkIfBatchFailed()) {
                        throw new Error("Too many embedding requests failed");
                    }
                    const query = buildGraphQuery(graphInput, graphName, chunk, docCollection);
                    const traversalResult = db._query(query).toArray();
                    chunkArray(traversalResult, modelMetadata.invocation.inference_batch_size)
                        .forEach(getAndSaveGraphEmbeddingsForMiniBatch(docCollection, dCollection, graphInput));
                });

            if (isLastBatch) {
                if (getEmbeddingsStatus(collectionName, destinationCollection, fieldName, modelMetadata) === EmbeddingsStatus.RUNNING_FAILED) {
                    handleFailure(false, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
                } else {
                    updateEmbeddingsStatus(EmbeddingsStatus.COMPLETED, collectionName, destinationCollection, fieldName, modelMetadata);
                }
            }
        } else {
            throw TypeError("Model Invocation Input Type is not 'graph'.")
        }
    } catch (e) {
        logErr(e);
        updateEmbeddingsStatus(EmbeddingsStatus.FAILED, collectionName, destinationCollection, fieldName, modelMetadata);
    }

    // No matter what, queue the next batch
    if (!isLastBatch && !checkIfBatchFailed()) {
        const q = queues.get(EMB_QUEUE_NAME);
        queueBatch(ScriptName.GRAPH,
            batchIndex + 1,
            batchSize,
            numberOfBatches,
            (batchOffset + batchSize),
            graphName,
            collectionName,
            fieldName,
            modelMetadata,
            q,
            destinationCollection,
            separateCollection,
            embeddingsRunColName
        );
    } else if(checkIfBatchFailed()) {
        logErr("Too many embedding requests failed, stopping process");
    } else {
        // If it's the last batch, then we can drop the embeddingsRun collection
        db._collection(embeddingsRunColName).drop();
    }
}

if (!embeddingsTargetsAreValid(graphName, collectionName)) {
    logMsg(`Combination of Embeddings target collection ${collectionName} and graph ${graphName} is no longer valid. Aborting generation...`);
} else {
    profileCall(createGraphEmbeddings)();
}

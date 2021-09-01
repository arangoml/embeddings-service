"use strict";
import {GenerationJobInputArgs} from "../utils/generation_job_input_args";
import {aql, db, query} from "@arangodb";
import Collection = ArangoDB.Collection;
import {GraphInput} from "../model/model_metadata";
import {logErr, logMsg} from "../utils/logging";
import {updateEmbeddingsStatus} from "../services/emb_status_service";
import {EmbeddingsStatus} from "../model/embeddings_status";
// import * as graph_module from "@arangodb/general-graph";

const {argv} = module.context;

const {batchIndex, batchSize, batchOffset, numberOfBatches, collectionName, destinationCollection, graphName, modelMetadata, fieldName, embeddingsRunColName}: GenerationJobInputArgs = argv[0];
const isLastBatch = (batchIndex >= (numberOfBatches - 1));
console.log(isLastBatch);

console.log(`Create graph/traversal based embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} 
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
                        "_key": a._key,
                        "field": ${currentChar}.${fieldName}
                    },
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
                        "_key": a._key,
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

interface TargetDoc {
    _key: string;
    field: string;
}

interface TraversalResult {
    node: TargetDoc;
    neighbors?: TraversalResult[];
}

function flattenTraversalResult(t: TraversalResult, index: number) {
    if (t.neighbors == undefined || t.neighbors.length == 0) {
        return {
            features: [t.node.field],
            adj_lists: []
        };
    } else {
        let cur_index = index + 1;
        const features = [t.node.field];
        const adj_mat = [[index, index]];
        const child_adj_mat_lists = [];

        for (let x of t.neighbors) {
            const result = flattenTraversalResult(x, cur_index);
            if (result.adj_lists.length > 0) {
                child_adj_mat_lists.push(result.adj_lists);
            }

            adj_mat.push([index, cur_index]);
            features.push(...result.features);
            cur_index += result.features.length;
        }

        const final_lists = [adj_mat];
        child_adj_mat_lists.forEach((child_lists) => {
            child_lists.forEach((child_list, ind) => {
                const l_ind = ind + 1;
                if (final_lists.length == l_ind) {
                    final_lists.push(Array.from(adj_mat.map(arr => Array.from(arr))));
                }
                final_lists[l_ind].push(...child_list);
            });
        });

        return {
            features,
            adj_lists: final_lists
        };
    }
}

function traversalResultToMatrixWithAdjacency(traversalResult: TraversalResult[]) {
    return traversalResult.map(res => flattenTraversalResult(res, 0));
}

function createGraphEmbeddings() {
    const docCollection = db._collection(collectionName);
    const embeddingsRunCol = db._collection(embeddingsRunColName);
    const targetIds = getTargetDocumentIds(1, batchOffset, docCollection, embeddingsRunCol, fieldName);

    // const graph = graph_module._graph(graphName);
    if (modelMetadata.invocation.input.kind == "graph") {
        const query = buildGraphQuery(modelMetadata.invocation.input, graphName, targetIds, docCollection);
        const traversalResult = db._query(query).toArray();
        const {features, adj_lists} = traversalResultToMatrixWithAdjacency(traversalResult)[0];
        logMsg(features.length);
        logMsg(adj_lists.length);
        updateEmbeddingsStatus(EmbeddingsStatus.FAILED, collectionName, destinationCollection, fieldName, modelMetadata);
    } else {
        throw TypeError("Model Invocation Input Type is not 'graph'.")
    }
}

createGraphEmbeddings();

"use strict";
import {GenerationJobInputArgs} from "../utils/generation_job_input_args";
import {aql, db, query} from "@arangodb";
import Collection = ArangoDB.Collection;
import {GraphInput} from "../model/model_metadata";
import {logErr, logMsg} from "../utils/logging";
// import * as graph_module from "@arangodb/general-graph";

const {argv} = module.context;

const {batchIndex, batchSize, numberOfBatches, batchOffset, collectionName, graphName, modelMetadata, fieldName, embeddingsRunColName}: GenerationJobInputArgs = argv[0];
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
            WITH ${docCollection.name()}
            FOR ${currentChar} IN 1 ANY ${prevChar} GRAPH ${graphName}
                SORT RAND()
                LIMIT ${sampleSizes[currentDepth]}
                RETURN {
                    "node": ${currentChar}
                }
        `;
    } else {
        return `
            WITH ${docCollection.name()}
            FOR ${currentChar} IN 1 ANY ${prevChar} GRAPH ${graphName}
                SORT RAND()
                LIMIT ${sampleSizes[currentDepth]}
                LET nh = (${buildSubQuery(currentDepth + 1, maxDepth, sampleSizes, graphName, docCollection)})
                RETURN {
                    "node": ${currentChar},
                    "neighbors": nh
                }
        `
    }
}


function buildGraphQuery(graphInput: GraphInput, graphName: string, targetDocs: any[], docCollection: Collection) {
    const subQuery = buildSubQuery(0, graphInput.neighborhood.number_of_hops - 1, graphInput.neighborhood.samples_per_hop, graphName, docCollection);
    logMsg(subQuery);
    return aql`
        FOR doc in ${targetDocs}
        FOR a IN ${docCollection} 
            FILTER a._key == doc._key
            LET nh = (
                ${aql.literal(subQuery)}
            )
            RETURN {
                "node": a,
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

function flattenTraversalResult(t: TraversalResult) {
    if (t.neighbors == undefined) {
        return [t.node.field];
    } else {

        return;
    }
}

function traversalResultToMatrixWithAdjacency(traversalResult: TraversalResult[]) {
    logMsg(traversalResult);
    // For each result, flatten it into, (1) A giant feature matrix. (2) Adjacency lists per level
    traversalResult.map(flattenTraversalResult);
}

function createGraphEmbeddings() {
    const docCollection = db._collection(collectionName);
    const embeddingsRunCol = db._collection(embeddingsRunColName);
    const targetIds = getTargetDocumentIds(1, batchOffset, docCollection, embeddingsRunCol, fieldName);
    logMsg(targetIds);

    // const graph = graph_module._graph(graphName);
    if (modelMetadata.invocation.input.kind == "graph") {
        const query = buildGraphQuery(modelMetadata.invocation.input, graphName, targetIds, docCollection);
        const traversalResult = db._query(query).toArray();
        traversalResultToMatrixWithAdjacency(traversalResult);
    } else {
        throw TypeError("Model Invocation Input Type is not 'graph'.")
    }
}

createGraphEmbeddings();

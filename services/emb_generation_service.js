"use strict";

const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
const {createAndAddEmbeddingsRunCollection} = require("./emb_collections_service");
const {getEmbeddingsStatusDict} = require("./emb_status_service");
const {getCountDocumentsWithoutEmbedding} = require("./emb_collections_service");
const {getEmbeddingsFieldName} = require("./emb_collections_service");
const {modelTypes} = require("../model/model_metadata");
const {EMB_QUEUE_NAME} = require("../utils/embeddings_queue");
const {query, db} = require("@arangodb");

const embeddingQueueName = EMB_QUEUE_NAME;

const scripts = {
    NODE: "createNodeEmbeddings",
    GRAPH: "createGraphEmbeddings"
};

function queueBatch(scriptName, i, batchSize, numBatches, batchOffset, graphName, colName, fieldName, modelMetadata, embeddingsQueue, destinationCollection, separateCollection, embeddingsRunColName) {
    embeddingsQueue.push(
        {
            mount: context.mount,
            name: scriptName
        },
        {
            collectionName: colName,
            batchIndex: i,
            batchSize: batchSize,
            numberOfBatches: numBatches,
            batchOffset: batchOffset,
            modelMetadata: modelMetadata,
            graphName: graphName,
            fieldName: fieldName,
            destinationCollection: destinationCollection,
            separateCollection: separateCollection,
            embeddingsRunColName: embeddingsRunColName,
        }
    );
}

/**
 * Queue batch jobs to generate embeddings for a specified model/scriptType.
 * Returns true if batch jobs have been queued. This does NOT mean that they've succeeded yet.
 */
function generateBatches(scriptType, graphName, embeddingsStatusDict, fieldName, separateCollection, modelMetadata, overwriteExisting) {
    const numberOfDocuments = getCountDocumentsWithoutEmbedding(
        embeddingsStatusDict,
        fieldName
    );

    // Create the embeddings run collection
    const embeddingsRunColName = createAndAddEmbeddingsRunCollection(embeddingsStatusDict, fieldName, overwriteExisting);

    const batch_size = 1000;
    const numBatches = Math.ceil(numberOfDocuments / batch_size);

    const embQ = queues.create(embeddingQueueName);

    // The queue will be invoked recursively
    queueBatch(
        scriptType,
        0,
        batch_size,
        numBatches,
        0,
        graphName,
        embeddingsStatusDict["collection"],
        fieldName,
        modelMetadata,
        embQ,
        embeddingsStatusDict["destination_collection"],
        separateCollection,
        embeddingsRunColName
    );
}

function generateBatchesForModel(graphName, embeddingsStatusDict, fieldName, separateCollection, modelMetadata, overwriteExisting = false) {
    switch (modelMetadata.model_type) {
        case modelTypes.WORD_EMBEDDING: {
            generateBatches(scripts.NODE, graphName, embeddingsStatusDict, fieldName, separateCollection, modelMetadata, overwriteExisting);
            return true;
        }
        case modelTypes.GRAPH_MODEL: {
            if (!graphName) {
                throw new Error("Requested to generate graph embeddings but no graph is provided");
            }
            generateBatches(scripts.GRAPH, graphName, embeddingsStatusDict, fieldName, separateCollection, modelMetadata, overwriteExisting);
            return true;
        }
        default:
            throw new Error(`Error: unrecognized model type: ${modelMetadata.model_type}`);
    }
}

exports.generateBatchesForModel = generateBatchesForModel;
exports.queueBatch = queueBatch;
exports.scripts = scripts;

"use strict";

const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
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

function queueBatch(scriptName, i, batchSize, numBatches, batchOffset, graphName, colName, fieldName, modelMetadata, embeddingsQueue, destinationCollection, separateCollection) {
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
        }
    );
}

/**
 * Queue batch jobs to generate embeddings for a specified model/scriptType.
 * Returns true if batch jobs have been queued. This does NOT mean that they've succeeded yet.
 */
function generateBatches(scriptType, graphName, collectionName, fieldName, destinationCollection, separateCollection, modelMetadata) {
    const numberOfDocuments = getCountDocumentsWithoutEmbedding(
        getEmbeddingsStatusDict(collectionName, destinationCollection, fieldName, modelMetadata),
        modelMetadata
    );

    const batch_size = modelMetadata.metadata.inference_batch_size;
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
        collectionName,
        fieldName,
        modelMetadata,
        embQ,
        destinationCollection,
        separateCollection
    );
}

function generateBatchesForModel(graphName, collectionName, fieldName, destinationCollection, separateCollection, modelMetadata) {
    switch (modelMetadata.model_type) {
        case modelTypes.WORD_EMBEDDING: {
            generateBatches(scripts.NODE, graphName, collectionName, fieldName, destinationCollection, separateCollection, modelMetadata);
            return true;
        }
        case modelTypes.GRAPH_MODEL: {
            if (!graphName) {
                throw new Error("Requested to generate graph embeddings but no graph is provided");
            }
            generateBatches(scripts.GRAPH, graphName, collectionName, fieldName, destinationCollection, separateCollection, modelMetadata);
            return true;
        }
        default:
            throw new Error(`Error: unrecognized model type: ${modelMetadata.model_type}`);
    }
}

exports.generateBatchesForModel = generateBatchesForModel;
exports.queueBatch = queueBatch;
exports.scripts = scripts;

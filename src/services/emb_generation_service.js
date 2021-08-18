"use strict";

const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
const {getCountEmbeddingsRunCollection, clearEmbeddingsRunCollection, createAndAddEmbeddingsRunCollection} = require("./embeddings_run_service");
const {ModelTypes} = require("../model/model_metadata");
const {EMB_QUEUE_NAME} = require("../utils/embeddings_queue");

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
function generateBatches(scriptType, embeddingsStatusDict, modelMetadata, overwriteExisting) {
    // Create the embeddings run collection
    const embeddingsRunColName = createAndAddEmbeddingsRunCollection(embeddingsStatusDict, overwriteExisting);
    const numberOfDocuments = getCountEmbeddingsRunCollection(embeddingsStatusDict);

    if (numberOfDocuments === 0) {
        // Undo creation for this run
        clearEmbeddingsRunCollection(embeddingsStatusDict);
        return false;
    }

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
        embeddingsStatusDict["graph_name"],
        embeddingsStatusDict["collection"],
        embeddingsStatusDict["field_name"],
        modelMetadata,
        embQ,
        embeddingsStatusDict["destination_collection"],
        embeddingsStatusDict["collection"] !== embeddingsStatusDict["destination_collection"],
        embeddingsRunColName
    );
    return true;
}

function generateBatchesForModel(embeddingsStatusDict, modelMetadata, overwriteExisting = false) {
    switch (modelMetadata.model_type) {
        case ModelTypes.WORD_EMBEDDING: {
            return generateBatches(scripts.NODE, embeddingsStatusDict, modelMetadata, overwriteExisting);
        }
        case ModelTypes.GRAPH_MODEL: {
            if (!graphName) {
                throw new Error("Requested to generate graph embeddings but no graph is provided");
            }
            return generateBatches(scripts.GRAPH, embeddingsStatusDict, modelMetadata, overwriteExisting);
        }
        default:
            throw new Error(`Error: unrecognized model type: ${modelMetadata.model_type}`);
    }
}

exports.generateBatchesForModel = generateBatchesForModel;
exports.queueBatch = queueBatch;
exports.scripts = scripts;

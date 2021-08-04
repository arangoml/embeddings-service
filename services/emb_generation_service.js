"use strict";

const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
const {modelTypes} = require("../model/model_metadata");
const {query, db} = require("@arangodb");

const embeddingQueueName = "embeddings_generation";

const scripts = {
    NODE: "createNodeEmbeddings",
    GRAPH: "createGraphEmbeddings"
};

function queueBatch(scriptName, i, batchSize, graphName, colName, fieldName, modelMetadata, embeddingsQueue, destinationCollection, separateCollection, isLastBatch) {
    embeddingsQueue.push(
        {
            mount: context.mount,
            name: scriptName
        },
        {
            collectionName: colName,
            batchIndex: i,
            modelMetadata: modelMetadata,
            graphName: graphName,
            fieldName: fieldName,
            batchSize: batchSize,
            destinationCollection: destinationCollection,
            separateCollection: separateCollection,
            isLastBatch: isLastBatch
        }
    );
}

/**
 * Queue batch jobs to generate embeddings for a specified model/scriptType.
 * Returns true if batch jobs have been queued. This does NOT mean that they've succeeded yet.
 */
function generateBatches(scriptType, graphName, collectionName, fieldName, destinationCollection, separateCollection, modelMetadata) {
    const myCol = db._collection(collectionName);
    // TODO: Change to handle existing separate collection
    // if the collection is present, then we need to filter not just on fields but also where there isn't a document
    const numberOfDocuments = query`
    RETURN COUNT(
        FOR doc in ${myCol}
        FILTER doc.${fieldName} != null
        RETURN 1
    )
    `.toArray();

    const batch_size = modelMetadata.metadata.inference_batch_size;
    const numBatches = Math.ceil(numberOfDocuments / batch_size);

    const embQ = queues.create(embeddingQueueName);

    Array(numBatches)
        .fill()
        .map((_, i) => i)
        .forEach(i => queueBatch(
            scriptType,
            i,
            batch_size,
            graphName,
            collectionName,
            fieldName,
            modelMetadata,
            embQ,
            destinationCollection,
            separateCollection,
            i === (numBatches - 1)
        ));
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

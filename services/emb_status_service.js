"use strict";
const {updateStatusByCollectionDestinationAndEmbName} = require("../db/embeddings_status");
const {createStatus} = require("../db/embeddings_status");
const {getStatusesByCollectionDestinationAndEmbName} = require("../db/embeddings_status");
const {getEmbeddingsFieldName} = require("./emb_collections_service");
const {embeddingsStatus} = require("../model/embeddings_status");

/**
 * Get the status of how the embeddings generation is going.
 */
function getEmbeddingsStatus(collectionName, destinationCollectionName, fieldName, modelMetadata) {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length == 0) {
        return embeddingsStatus.DOES_NOT_EXIST;
    }
    return res[0]["status"];
}

/**
 * Get the document ID of an embedding status. Returns `null` if not found.
 */
function getEmbeddingsStatusDocId(collectionName, destinationCollectionName, fieldName, modelMetadata) {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length == 0) {
        return null;
    }
    return res[0]["_key"];
}

/**
 * Create a new status of how the embeddings generation is going.
 */
function createEmbeddingsStatus(collectionName, destinationCollectionName, fieldName, modelMetadata) {
    createStatus(
        collectionName,
        destinationCollectionName,
        getEmbeddingsFieldName(fieldName, modelMetadata),
        embeddingsStatus.RUNNING
    );
}

/**
 * Update the status of how the embeddings generation is going.
 */
function updateEmbeddingsStatus(newStatus, collectionName, destinationCollectionName, fieldName, modelMetadata) {
    updateStatusByCollectionDestinationAndEmbName(
        collectionName,
        destinationCollectionName,
        getEmbeddingsFieldName(fieldName, modelMetadata),
        newStatus
    );
}

exports.getEmbeddingsStatus = getEmbeddingsStatus;
exports.getEmbeddingsStatusDocId = getEmbeddingsStatusDocId;
exports.createEmbeddingsStatus = createEmbeddingsStatus;
exports.updateEmbeddingsStatus = updateEmbeddingsStatus;

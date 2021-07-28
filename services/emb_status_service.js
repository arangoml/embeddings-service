"use strict";
const {query, db} = require("@arangodb");
const {getEmbeddingsFieldName} = require("./emb_collections_service");
const {embeddingsStatusCollectionName, embeddingsStatus} = require("../model/embeddings_status");

/**
 * Get the status of how the embeddings generation is going.
 */
function getEmbeddingsStatus(collectionName, destinationCollectionName, fieldName, modelMetadata) {
    const col = db._collection(embeddingsStatusCollectionName);
    const res = query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${getEmbeddingsFieldName(fieldName, modelMetadata)}
        RETURN d
    `.toArray();
    if (res.length == 0) {
        return embeddingsStatus.DOES_NOT_EXIST;
    }
    return res[0]["status"];
}

/**
 * Get the document ID of an embedding status. Returns `null` if not found.
 */
function getEmbeddingsStatusDocId(collectionName, destinationCollectionName, fieldName, modelMetadata) {
    const col = db._collection(embeddingsStatusCollectionName);
    const res = query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${getEmbeddingsFieldName(fieldName, modelMetadata)}
        RETURN d
    `.toArray();
    if (res.length == 0) {
        return null;
    }
    return res[0]["_key"];
}
/**
 * Create a new status of how the embeddings generation is going.
 */
function createEmbeddingsStatus(collectionName, destinationCollectionName, fieldName, modelMetadata) {
    const col = db._collection(embeddingsStatusCollectionName);
    query`
    INSERT {
        collection: ${collectionName},
        destination_collection: ${destinationCollectionName},
        emb_field_name: ${getEmbeddingsFieldName(fieldName, modelMetadata)},
        status: ${embeddingsStatus.RUNNING}
    } INTO ${col}
    `;
}

/**
 * Update the status of how the embeddings generation is going.
 */
function updateEmbeddingsStatus(newStatus, collectionName, destinationCollectionName, fieldName, modelMetadata) {
    const col = db._collection(embeddingsStatusCollectionName);
    query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${getEmbeddingsFieldName(fieldName, modelMetadata)}
        UPDATE d._key WITH { status: ${newStatus} } IN ${col}
    `;
}
exports.getEmbeddingsStatus = getEmbeddingsStatus;
exports.getEmbeddingsStatusDocId = getEmbeddingsStatusDocId;
exports.createEmbeddingsStatus = createEmbeddingsStatus;
exports.updateEmbeddingsStatus = updateEmbeddingsStatus;

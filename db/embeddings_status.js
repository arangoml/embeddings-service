/**
 * This module is responsible for queries interacting with the Embeddings status metadata collection
 */
"use strict";
const {query, db} = require("@arangodb");
const {embeddingsStatusCollectionName} = require("../model/embeddings_status");

function getStatusByKey(key) {
    const col = db._collection(embeddingsStatusCollectionName);
    const statuses = query`
    FOR d in ${col}
        FILTER d._key == ${key}
        RETURN d
    `.toArray();
    if (statuses.length == 0) {
        return null;
    }
    return statuses[0];
}

function getStatusesByCollectionAndEmbName(collectionName, embeddingsFieldName) {
    const col = db._collection(embeddingsStatusCollectionName);
    const statuses = query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        RETURN d
    `.toArray();
    return statuses;
}

function getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, embeddingsFieldName) {
    const col = db._collection(embeddingsStatusCollectionName);
    const res = query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        RETURN d
    `.toArray();
    return res;
}

function createStatus(collectionName, destinationCollectionName, embeddingsFieldName, status) {
    const col = db._collection(embeddingsStatusCollectionName);
    query`
    INSERT {
        collection: ${collectionName},
        destination_collection: ${destinationCollectionName},
        emb_field_name: ${embeddingsFieldName},
        status: ${status}
    } INTO ${col}
    `;
}

function updateStatusByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, embeddingsFieldName, newStatus) {
    const col = db._collection(embeddingsStatusCollectionName);
    query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        UPDATE d._key WITH { status: ${newStatus} } IN ${col}
    `;
}

exports.getStatusByKey = getStatusByKey;
exports.getStatusesByCollectionAndEmbName = getStatusesByCollectionAndEmbName;
exports.getStatusesByCollectionDestinationAndEmbName = getStatusesByCollectionDestinationAndEmbName;
exports.createStatus = createStatus;
exports.updateStatusByCollectionDestinationAndEmbName = updateStatusByCollectionDestinationAndEmbName;
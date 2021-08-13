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
    if (statuses.length === 0) {
        return null;
    }
    return statuses[0];
}

function getStatusesByCollectionAndEmbName(collectionName, embeddingsFieldName) {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        RETURN d
    `.toArray();
}

function getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, embeddingsFieldName) {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        RETURN d
    `.toArray();
}

function createStatus(collectionName, destinationCollectionName, embeddingsFieldName, fieldName, status, timestamp) {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    INSERT {
        collection: ${collectionName},
        destination_collection: ${destinationCollectionName},
        emb_field_name: ${embeddingsFieldName},
        field_name: ${fieldName},
        status: ${status},
        last_run_timestamp: ${timestamp}
    } INTO ${col} RETURN NEW
    `.toArray()[0];
}

function updateStatusByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, embeddingsFieldName, newStatus, timestamp) {
    const col = db._collection(embeddingsStatusCollectionName);
    query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        UPDATE d._key WITH {
            status: ${newStatus},
            last_run_timestamp: ${timestamp} 
        } IN ${col}
    `;
}

exports.getStatusByKey = getStatusByKey;
exports.getStatusesByCollectionAndEmbName = getStatusesByCollectionAndEmbName;
exports.getStatusesByCollectionDestinationAndEmbName = getStatusesByCollectionDestinationAndEmbName;
exports.createStatus = createStatus;
exports.updateStatusByCollectionDestinationAndEmbName = updateStatusByCollectionDestinationAndEmbName;
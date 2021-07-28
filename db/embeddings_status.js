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

exports.getStatusByKey = getStatusByKey;
exports.getStatusesByCollectionAndEmbName = getStatusesByCollectionAndEmbName;
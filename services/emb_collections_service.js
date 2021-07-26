"use strict";

const {db} = require("@arangodb");

function nameForCollectionAndModel(collectionName, modelName) {
    return `emb_${collectionName}_${modelName}`;
}

function getDestinationCollectionName(collectionName, separateCollection, modelMetadata) {
    // If not a separate collection, store on documents
    if (!separateCollection) {
        return collectionName;
    }
    // Otherwise create the separate collection name
    const colName = nameForCollectionAndModel(collectionName, modelMetadata.name);

    // And create it if it doesn't already exist
    if (!db._collection(colName)) {
        db._createDocumentCollection(colName);
    }

    // Then return it
    return colName;
}

exports.getDestinationCollectionName = getDestinationCollectionName;
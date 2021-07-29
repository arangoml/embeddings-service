"use strict";

const {query, db} = require("@arangodb");

function colNameForCollectionAndModel(collectionName, modelName) {
    return `emb_${collectionName}_${modelName}`;
}

function getDestinationCollectionName(collectionName, separateCollection, modelMetadata) {
    // If not a separate collection, store on documents
    if (!separateCollection) {
        return collectionName;
    }
    // Otherwise create the separate collection name
    const colName = colNameForCollectionAndModel(collectionName, modelMetadata.name);

    // And create it if it doesn't already exist
    if (!db._collection(colName)) {
        db._createDocumentCollection(colName);
    }

    // Then return it
    return colName;
}

function getEmbeddingsFieldName(fieldName, modelMetadata) {
    return `emb_${modelMetadata.name}_${fieldName}`;
}

function deleteEmbeddingsFieldEntries(destinationCollectionName, sourceFieldName, modelMetadata) {
    const dCol = db._collection(destinationCollectionName);
    const embedding_field_name = getEmbeddingsFieldName(sourceFieldName, modelMetadata);
    query`
    FOR doc in ${dCol}
      FILTER doc[${embedding_field_name}] != null
      UPDATE doc WITH { ${embedding_field_name}: null } IN ${dCol} OPTIONS { keepNull: false }
    `;
}

exports.getDestinationCollectionName = getDestinationCollectionName;
exports.getEmbeddingsFieldName = getEmbeddingsFieldName;
exports.deleteEmbeddingsFieldEntries = deleteEmbeddingsFieldEntries;
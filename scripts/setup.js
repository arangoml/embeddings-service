"use strict";

const db = require("@arangodb").db;
const {context} = require("@arangodb/locals");

const METADATA_DOC_COLLECTION = context.collectionName("_model_metadata");

function createModelMetadataCollection() {
    if (!db._collection(METADATA_DOC_COLLECTION)) {
        db._createDocumentCollection(METADATA_DOC_COLLECTION);
    }
    return db._collection(METADATA_DOC_COLLECTION);
}

const modelTypes = {
    WORD_EMBEDDING: "word_embedding_model",
    GRAPH_MODEL: "graph_embedding_model"
};

exports.modelTypes = modelTypes;

const seedData = [
    {
        type: modelTypes.WORD_EMBEDDING,
        name: "DistilBERT",
        _key: "DistilBERT",
        emb_dim: 768
    },
    {
        type: modelTypes.GRAPH_MODEL,
        name: "GraphSAGE",
        _key: "GraphSAGE",
        emb_dim: 64
    }
];

function seedMetadataCol(collection) {
    collection.insert(seedData, { waitForSync: true });
}

const modelMetadataCol = createModelMetadataCollection();
seedMetadataCol(modelMetadataCol);

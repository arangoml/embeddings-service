"use strict";

const db = require("@arangodb").db;
const {context} = require("@arangodb/locals");

const METADATA_DOC_COLLECTION = context.collectionName("_model_metadata");

const modelTypes = {
    WORD_EMBEDDING: "word_embedding_model",
    GRAPH_MODEL: "graph_embedding_model"
};

exports.modelTypes = modelTypes;

const modelMetadataSchema = {
    rule: {
        "type": "object",
        "properties": {
            "model_type": { "enum": [modelTypes.WORD_EMBEDDING, modelTypes.GRAPH_MODEL] },
            "name": { "type": "string" },
            "emb_dim": { "type": "number" },
            "invocation_name": { "type": "string" },
            "framework": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" }
                },
                "required": ["name"]
            },
            "website": { "type": "string" }
        },
        "required": ["model_type", "name", "emb_dim", "invocation_name", "framework"]
    },
    level: "moderate",
    message: "The model's metadata is invalid"
};

function createModelMetadataCollection() {
    if (!db._collection(METADATA_DOC_COLLECTION)) {
        db._createDocumentCollection(METADATA_DOC_COLLECTION, { "schema": modelMetadataSchema });
    }
    return db._collection(METADATA_DOC_COLLECTION);
}

const seedData = [
    {
        model_type: modelTypes.WORD_EMBEDDING,
        name: "distilbert-base-uncased",
        _key: "distilbert-base-uncased",
        framework: {
            name: "pytorch"
        },
        emb_dim: 768,
        website: "https://huggingface.co/distilbert-base-uncased",
        // This is the name that this model will have on the compute node. May differ from display name
        invocation_name: "distilbert-base-uncased"
    },
    {
        model_type: modelTypes.GRAPH_MODEL,
        name: "graph-sage",
        _key: "graph-sage",
        framework: {
            name: "pytorch"
        },
        emb_dim: 64,
        invocation_name: "graph-sage"
    }
];

function seedMetadataCol(collection) {
    collection.insert(seedData);
}

const modelMetadataCol = createModelMetadataCollection();
seedMetadataCol(modelMetadataCol);

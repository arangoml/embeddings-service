"use strict";

const db = require("@arangodb").db;
const {context} = require("@arangodb/locals");

const METADATA_DOC_COLLECTION = context.collectionName("_model_metadata");

const modelTypes = {
    WORD_EMBEDDING: "word_embedding_model",
    GRAPH_MODEL: "graph_embedding_model"
};

exports.modelTypes = modelTypes;
exports.metadataCollectionName = METADATA_DOC_COLLECTION;

const modelMetadataSchema = {
    rule: {
        "type": "object",
        "properties": {
            "model_type": { "enum": [modelTypes.WORD_EMBEDDING, modelTypes.GRAPH_MODEL] },
            "name": { "type": "string" },
            "invocation_name": { "type": "string" },
            "framework": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "version": { "type": "string" }
                },
                "required": ["name"]
            },
            "website": { "type": "string" },
            "data": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_id": { "type": "string" },
                        "domain": { "type": "string" }, // make this an enum? TBD
                        "website": { "type": "string" },
                    }
                }
            },
            "metadata": {
                "type": "object",
                "properties": {
                    "emb_dim": { "type": "number" },
                    "schema": {
                        "type": "object",
                        "properties": {
                            "features": {
                                "type": "array",
                                "items": { "type": "string" }
                            },
                            "type": { "type": "string" },
                            "input_shape": {
                                "type": "array",
                                "items": { "type": "number" }
                            }
                        },
                    },
                    "metrics": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": { "type": "string" },
                                "value": { "type": ["number", "string" ]},
                                "value_type": { "type": "string" }
                            },
                            "required": ["key", "value", "value_type"]
                        }
                    }
                },
                "required": ["emb_dim"]
            },
            "train": {
                "type": "object",
                "training_params": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {},
                    }
                }
            }
        },
        "required": ["model_type", "name", "metadata", "invocation_name", "framework"]
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
            name: "pytorch",
            version: "1.9.0"
        },
        website: "https://huggingface.co/distilbert-base-uncased",
        // This is the name that this model will have on the compute node. May differ from display name
        invocation_name: "distilbert-base-uncased",
        data: [ // A list of the datasets that were used during training
            // modification of the MLSpec - MLSpec has a single data source specified
            {
                source_id: "BOOK-CORPUS",
                domain: "text",
                website: "https://yknzhu.wixsite.com/mbweb"
            },
            {
                source_id: "EN-Wikipedia",
                domain: "text",
                website: "https://en.wikipedia.org/wiki/English_Wikipedia"
            }
        ],
        metadata: {
            emb_dim: 768,
            schema: {
                type: "RAW/TEXT",
            }
        }
    },
    {
        model_type: modelTypes.GRAPH_MODEL,
        name: "graph-sage",
        _key: "graph-sage",
        framework: {
            name: "pytorch",
            version: "1.9.0"
        },
        invocation_name: "graph-sage",
        data: [
            {
                source_id: "AMAZON-PRODUCT-CoPurchase",
                domain: "graph",
                website: "https://snap.stanford.edu/data/amazon0601.html"
            }
        ],
        train: {
            // hyper-parameters etc
            training_params: [
                {learning_rate: 0.01},
                {loss: "cross-entropy"},
                {batch_size: 64},
                {epochs: 50},
            ]
        },
        metadata: {
            emb_dim: 256,
            schema: {
                features: ["bag_of_words"],
                type: "NUMERIC",
                input_shape: [256, 1],
            },
            metrics: [
                {
                    key: "mrr",
                    value: 0.567,
                    value_type: "NUMBER"
                }
            ],
        }
    }
];

function seedMetadataCol(collection) {
    collection.insert(seedData);
}

const modelMetadataCol = createModelMetadataCollection();
seedMetadataCol(modelMetadataCol);

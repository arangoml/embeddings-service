"use strict";
const {context} = require("@arangodb/locals");

const METADATA_DOC_COLLECTION = context.collectionName("_model_metadata");

const modelTypes = {
    WORD_EMBEDDING: "word_embedding_model",
    GRAPH_MODEL: "graph_embedding_model"
};

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


exports.modelTypes = modelTypes;
exports.metadataCollectionName = METADATA_DOC_COLLECTION;
exports.modelMetadataSchema = modelMetadataSchema;
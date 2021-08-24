"use strict";

import {context} from "@arangodb/locals";

export const metadataCollectionName = context.collectionName("_model_metadata");

export enum ModelTypes {
    WORD_EMBEDDING = "word_embedding_model",
    GRAPH_MODEL = "graph_embedding_model"
};

interface ModelSchema {
    features?: string[];
    type?: string;
    input_shape?: number[];
};

interface ModelMetric {
    key: string;
    value: string | number;
    value_type: string;
};

interface Metadata {
    emb_dim: number;
    inference_batch_size: number;
    schema?: ModelSchema;
    metrics?: ModelMetric[];
};

export interface ModelMetadata {
    model_type: string;
    name: string;
    invocation_name: string;
    metadata: Metadata;
    framework: Object;
};

export const modelMetadataSchema = {
    rule: {
        "type": "object",
        "properties": {
            "model_type": { "enum": [ModelTypes.WORD_EMBEDDING, ModelTypes.GRAPH_MODEL] },
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
                    "inference_batch_size": { "type": "number" },
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
                "required": ["emb_dim", "inference_batch_size"]
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
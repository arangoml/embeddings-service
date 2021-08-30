"use strict";

import {context} from "@arangodb/locals";

export const metadataCollectionName = context.collectionName("_model_catalog");

export enum ModelTypes {
    WORD_EMBEDDING = "word_embedding_model",
    GRAPH_MODEL = "graph_embedding_model"
};

interface NeighborhoodInformation {
    number_of_hops: number;
    samples_per_hop: number[];
};

interface GraphInput {
    neighborhood: NeighborhoodInformation;
    feature_dim: number;
    features_input_key: string;
    adjacency_list_input_keys: string[];
    adjacency_sizes_input_keys: string[];
};

export enum FieldType {
    TEXT = "text"
}

interface FieldInput {
    field_type: FieldType;
    input_key: string;
};

type InvocationInput = FieldInput | GraphInput;

interface SingleOutput {
    output_key: string;
    index?: number;
};

type InvocationOutput = SingleOutput;

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

interface ModelInvocationMetadata {
    emb_dim: number;
    inference_batch_size: number;
    invocation_name: string;
    input: InvocationInput;
    output: InvocationOutput;
};

interface Metadata {
    schema?: ModelSchema;
    metrics?: ModelMetric[];
};

export interface ModelMetadata {
    model_type: string;
    name: string;
    invocation: ModelInvocationMetadata;
    metadata: Metadata;
    framework: Object;
};

export const modelMetadataSchema = {
    rule: {
        "type": "object",
        "properties": {
            "model_type": { "enum": [ModelTypes.WORD_EMBEDDING, ModelTypes.GRAPH_MODEL] },
            "name": { "type": "string" },
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
            "invocation": {
                "type": "object",
                "properties": {
                    "emb_dim": { "type": "number" },
                    "inference_batch_size": { "type": "number" },
                    "invocation_name": { "type": "string" },
                    "input": {
                        "oneOf": [
                            {
                                "type": "object",
                                "properties": {
                                    "field_type": {"enum": Object.values(FieldType)},
                                    "input_key": {"type": "string"}
                                },
                                "required": ["field_type", "input_key"]
                            },
                            {
                                "type": "object",
                                "properties": {
                                    "neighborhood": {
                                        "type": "object",
                                        "properties": {
                                            "number_of_hops": { "type": "number" },
                                            "samples_per_hop": {
                                                "type": "array",
                                                "items": { "type": "number" }
                                            },
                                        },
                                        "required": ["number_of_hops", "samples_per_hop"]
                                    },
                                    "feature_dim": { "type": "number" },
                                    "features_input_key": { "type": "string" },
                                    "adjacency_list_input_keys": {
                                        "type": "array",
                                        "items": { "type": "string" }
                                    },
                                    "adjacency_size_input_keys": {
                                        "type": "array",
                                        "items": { "type": "string" }
                                    },
                                },
                                "required": ["neighborhood", "feature_dim", "features_input_key", "adjacency_list_input_keys", "adjacency_size_input_keys"]
                            }
                        ]
                    },
                    "output": {
                        "type": "object",
                        "properties": {
                            "output_key": { "type": "string" },
                            "index": { "type": "number" }
                        },
                        "required": ["output_key"]
                    }
                },
                "required": ['emb_dim', "inference_batch_size", "invocation_name", "input", "output"]
            },
            "metadata": {
                "type": "object",
                "properties": {
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
        "required": ["model_type", "name", "metadata", "invocation", "framework"]
    },
    level: "moderate",
    message: "The model's metadata is invalid"
};
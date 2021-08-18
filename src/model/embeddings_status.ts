"use strict";

import {context} from "@arangodb/locals";
import {ModelTypes} from "./model_metadata";

export interface EmbeddingsState {
    graph_name?: string;
    model_key: string;
    model_type: ModelTypes;
    emb_field_name: string;
    field_name: string;
    collection: string;
    destination_collection: string;
    status: EmbeddingsStatus;
    last_run_timestamp: string;
    _key: string;
};

export enum EmbeddingsStatus {
    RUNNING= "running",
    RUNNING_FAILED = "running_failed",
    FAILED = "failed",
    COMPLETED = "completed",
    DOES_NOT_EXIST = "do_not_exist"
};

export const embeddingsStatusCollectionName = context.collectionName("_status");
export const embeddingsStatusSchema = {
    rule: {
        "type": "object",
        "properties": {
            "graph_name": { "type": "string" },
            "model_key": { "type": "string" },
            "model_type": {
                "enum": Object.values(ModelTypes)
            },
            "emb_field_name": { "type": "string" },
            "field_name": { "type": "string" },
            "collection": { "type": "string" },
            "destination_collection": { "type": "string" },
            "status": {
                "enum": [
                    EmbeddingsStatus.RUNNING,
                    EmbeddingsStatus.RUNNING_FAILED,
                    EmbeddingsStatus.FAILED,
                    EmbeddingsStatus.COMPLETED,
                    EmbeddingsStatus.DOES_NOT_EXIST,
                ]
            },
            "last_run_timestamp": { "type": "string" }
        },
        "required": [
            "model_key",
            "model_type",
            "emb_field_name",
            "collection",
            "destination_collection",
            "status",
            "last_run_timestamp"
        ]
    },
    level: "moderate",
    message: "The embeddings status is invalid"
};
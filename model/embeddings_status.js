"use strict";

const {context} = require("@arangodb/locals");
const {modelTypes} = require("./model_metadata");

const embeddingsStatus = {
    RUNNING: "running",
    RUNNING_FAILED: "running_failed",
    FAILED: "failed",
    COMPLETED: "completed",
    DOES_NOT_EXIST: "do_not_exist"
};

const embeddingsStatusCollectionName = context.collectionName("_status");
const embeddingsStatusSchema = {
    rule: {
        "type": "object",
        "properties": {
            "graph_name": { "type": "string" },
            "model_key": { "type": "string" },
            "model_type": {
                "enum": Object.values(modelTypes)
            },
            "emb_field_name": { "type": "string" },
            "field_name": { "type": "string" },
            "collection": { "type": "string" },
            "destination_collection": { "type": "string" },
            "status": {
                "enum": [
                    embeddingsStatus.RUNNING,
                    embeddingsStatus.RUNNING_FAILED,
                    embeddingsStatus.FAILED,
                    embeddingsStatus.COMPLETED,
                    embeddingsStatus.DOES_NOT_EXIST,
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

exports.embeddingsStatus = embeddingsStatus;
exports.embeddingsStatusCollectionName = embeddingsStatusCollectionName;
exports.embeddingsStatusSchema = embeddingsStatusSchema;

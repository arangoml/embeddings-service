"use strict";

const {context} = require("@arangodb/locals");

const embeddingsStatus = {
    RUNNING: "running",
    RUNNING_FAILED: "running_failed",
    FAILED: "failed",
    COMPLETED: "completed",
};

const embeddingsStatusCollectionName = context.collectionName("_status");
const embeddingsStatusSchema = {
    rule: {
        "type": "object",
        "properties": {
            "emb_field_name": { "type": "string" },
            "collection": { "type": "string" },
            "status": { "enum": [
                    embeddingsStatus.RUNNING,
                    embeddingsStatus.RUNNING_FAILED,
                    embeddingsStatus.FAILED,
                    embeddingsStatus.COMPLETED,
                ] }
        },
        "required": ["emb_field_name", "collection", "status"]
    },
    level: "moderate",
    message: "The embeddings status is invalid"
};

exports.embeddingsStatusCollectionName = embeddingsStatusCollectionName;
exports.embeddingsStatusSchema = embeddingsStatusSchema;

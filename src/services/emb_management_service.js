"use strict";

const {EmbeddingsStatus} = require("../model/embeddings_status");
const {pruneEmbeddings, getCountDocumentsWithoutEmbedding} = require("./emb_collections_service");
const {updateEmbeddingsStatusDict} = require("./emb_status_service");
const {generateBatchesForModel} = require("./emb_generation_service");
const {embeddingsTargetsAreValid} = require("../utils/embeddings_target");

function pruneEmbeddingsIfNeeded(embeddingsStatusDict, overwriteExisting) {
    if (!overwriteExisting) {
        switch (embeddingsStatusDict["status"]) {
            case EmbeddingsStatus.DOES_NOT_EXIST:
            case EmbeddingsStatus.RUNNING:
            case EmbeddingsStatus.RUNNING_FAILED:
                // Don't need to prune in these cases
                return;
            default:
            // NOP
        }
    }
    pruneEmbeddings(embeddingsStatusDict);
}

function determineGenerationNeededForStatus(embeddingsStatusDict, overwriteExisting) {
    const start_msg = "Queued generation of embeddings!";
    let message = "";
    let shouldEmbed = true;

    switch (embeddingsStatusDict["status"]) {
        case EmbeddingsStatus.DOES_NOT_EXIST:
        case EmbeddingsStatus.FAILED:
            message = start_msg;
            break;
        case EmbeddingsStatus.RUNNING:
        case EmbeddingsStatus.RUNNING_FAILED:
            if (overwriteExisting) {
                message = "Overwriting old embeddings. " + start_msg;
            } else {
                shouldEmbed = false;
                message = "Generation of embeddings is already running!";
            }
            break;
        case EmbeddingsStatus.COMPLETED:
            // first check if we have any documents that don't already have an embedding
            if (!overwriteExisting) {
                if (getCountDocumentsWithoutEmbedding(embeddingsStatusDict, embeddingsStatusDict["field_name"]) !== 0) {
                    message = "Adding new embeddings. " + start_msg;
                } else {
                    shouldEmbed = false;
                    message = "These embeddings have already been generated!";
                }
            } else {
                message = "Overwriting old embeddings. " + start_msg;
            }
            break;
    }

    return {
        shouldGenerate: shouldEmbed,
        message: message
    };
}

function manageEmbeddingsForDocFieldAndModel(embStatusDict, modelMetadata, overwriteExisting) {
    let response_dict = {};

    // TODO: Decide on behavior if embeddings are no longer valid (e.g. the graph or collection has been deleted)
    if (embeddingsTargetsAreValid(embStatusDict["graph_name"], embStatusDict["collection"])) {
        pruneEmbeddingsIfNeeded(embStatusDict, overwriteExisting);

        const {shouldGenerate, message} = determineGenerationNeededForStatus(embStatusDict, overwriteExisting);
        response_dict["message"] = message;

        if (shouldGenerate) {
            updateEmbeddingsStatusDict(embStatusDict, EmbeddingsStatus.RUNNING);
            if (generateBatchesForModel(embStatusDict, modelMetadata, overwriteExisting)) {
                // NOP
            } else {
                updateEmbeddingsStatusDict(embStatusDict, EmbeddingsStatus.COMPLETED);
                response_dict["message"] = "Nothing to embed.";
            }
        }
    } else {
        // NOP for now
        response_dict["message"] = "Target Documents are in an invalid state, please check your DB";
    }

    response_dict["embeddings_status_id"] = embStatusDict["_key"];
    return response_dict;
}

exports.manageEmbeddingsForDocFieldAndModel = manageEmbeddingsForDocFieldAndModel;

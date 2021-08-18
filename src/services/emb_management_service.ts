"use strict";

import {EmbeddingsState, EmbeddingsStatus} from "../model/embeddings_status";
import {pruneEmbeddings, getCountDocumentsWithoutEmbedding} from "./emb_collections_service";
import {updateEmbeddingsStatusDict} from "./emb_status_service";
import {generateBatchesForModel} from "./emb_generation_service";
import {embeddingsTargetsAreValid} from "../utils/embeddings_target";
import {ModelMetadata} from "../model/model_metadata";

function pruneEmbeddingsIfNeeded(embeddingsState: EmbeddingsState, overwriteExisting: boolean): void {
    if (!overwriteExisting) {
        switch (embeddingsState.status) {
            case EmbeddingsStatus.DOES_NOT_EXIST:
            case EmbeddingsStatus.RUNNING:
            case EmbeddingsStatus.RUNNING_FAILED:
                // Don't need to prune in these cases
                return;
            default:
            // NOP
        }
    }
    pruneEmbeddings(embeddingsState);
}

function determineGenerationNeededForStatus(embeddingsState: EmbeddingsState, overwriteExisting: boolean): { shouldGenerate: boolean; message: string } {
    const start_msg = "Queued generation of embeddings!";
    let message = "";
    let shouldEmbed = true;

    switch (embeddingsState.status) {
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
                if (getCountDocumentsWithoutEmbedding(embeddingsState, embeddingsState.field_name) !== 0) {
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

export function manageEmbeddingsForDocFieldAndModel(embeddingsState: EmbeddingsState, modelMetadata: ModelMetadata, overwriteExisting: boolean): { [key: string]: string } {
    let response_dict: { [key: string]: string } = {};

    // TODO: Decide on behavior if embeddings are no longer valid (e.g. the graph or collection has been deleted)
    if (embeddingsTargetsAreValid(embeddingsState["graph_name"], embeddingsState["collection"])) {
        pruneEmbeddingsIfNeeded(embeddingsState, overwriteExisting);

        const {shouldGenerate, message} = determineGenerationNeededForStatus(embeddingsState, overwriteExisting);
        response_dict["message"] = message;

        if (shouldGenerate) {
            updateEmbeddingsStatusDict(embeddingsState, EmbeddingsStatus.RUNNING);
            if (generateBatchesForModel(embeddingsState, modelMetadata, overwriteExisting)) {
                // NOP
            } else {
                updateEmbeddingsStatusDict(embeddingsState, EmbeddingsStatus.COMPLETED);
                response_dict["message"] = "Nothing to embed.";
            }
        }
    } else {
        // NOP for now
        response_dict["message"] = "Target Documents are in an invalid state, please check your DB";
    }

    response_dict["embeddings_status_id"] = embeddingsState["_key"];
    return response_dict;
}
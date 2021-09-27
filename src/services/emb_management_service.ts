"use strict";

import {EmbeddingsState, EmbeddingsStatus} from "../model/embeddings_status";
import {pruneEmbeddings, getCountDocumentsWithoutEmbedding} from "./emb_collections_service";
import {updateEmbeddingsStateWithSpecificDocuments, updateEmbeddingsStatusDict} from "./emb_status_service";
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

export function manageEmbeddingsForDocFieldAndModel(embeddingsState: EmbeddingsState, modelMetadata: ModelMetadata, overwriteExisting: boolean, specificDocuments?: string[]): { [key: string]: string } {
    let response_dict: { [key: string]: string } = {};

    if (embeddingsTargetsAreValid(embeddingsState["graph_name"], embeddingsState["collection"])) {
        if (specificDocuments) {
            if (embeddingsState.specific_documents.length > 0) {
                if (specificDocuments.length > 0) {
                    // Then expand the documents here
                    embeddingsState.specific_documents.push(...specificDocuments);
                    embeddingsState.specific_documents = embeddingsState.specific_documents
                        .filter((value, index, specificDocsArr) => specificDocsArr.indexOf(value) === index);
                } else {
                    // If the specific documents is empty, then widen scope to all documents
                    embeddingsState.specific_documents = [];
                }
                updateEmbeddingsStateWithSpecificDocuments(embeddingsState, embeddingsState.specific_documents);
            }
            // Otherwise this is a NO-OP because we don't want to narrow the scope of the documents
        }

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
        // NOP for now if target collections/graphs are in an invalid state
        response_dict["message"] = "Target Documents are in an invalid state, please check your DB";
    }

    response_dict["embeddings_status_id"] = embeddingsState["_key"];
    return response_dict;
}
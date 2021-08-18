"use strict";
import {updateStatusByCollectionDestinationAndEmbName, updateEmbeddingsStatusByKey} from "../db/embeddings_status";
import {createStatus} from "../db/embeddings_status";
import {getStatusesByCollectionDestinationAndEmbName} from "../db/embeddings_status";
import {getEmbeddingsFieldName} from "./emb_collections_service";
import {EmbeddingsStatus, EmbeddingsState} from "../model/embeddings_status";
import {ModelMetadata} from "../model/model_metadata";

/**
 * Get the status of how the embeddings generation is going.
 */
export function getEmbeddingsStatus(collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): EmbeddingsStatus {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length === 0) {
        return EmbeddingsStatus.DOES_NOT_EXIST;
    }
    return res[0]["status"];
}

/**
 * Get the document ID of an embedding status. Returns `undefined` if not found.
 */
// TODO: Replace undefined
export function getEmbeddingsStatusDocId(collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): string | undefined {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length === 0) {
        return undefined;
    }
    return res[0]["_key"];
}

/**
 * Get the entire embedding status entry. Returns `undefined` if not found
 */
// TODO: Replace undefined
export function getEmbeddingsStatusDict(collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): EmbeddingsState | undefined {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length === 0) {
        return undefined;
    }
    return res[0];
}

/**
 * Get or create embeddings status. New embeddings status will be initialized to DOES_NOT_EXIST
 */
export function getOrCreateEmbeddingsStatusDict(graphName: string, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): EmbeddingsState {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata));
    if (res.length === 0) {
        return createEmbeddingsStatus(graphName, collectionName, destinationCollectionName, fieldName, modelMetadata, EmbeddingsStatus.DOES_NOT_EXIST);
    }
    return res[0];
}

/**
 * Create a new status of how the embeddings generation is going.
 */
export function createEmbeddingsStatus(graphName: string, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata, startStatus = EmbeddingsStatus.DOES_NOT_EXIST): EmbeddingsState {
    return createStatus(
        graphName,
        collectionName,
        destinationCollectionName,
        getEmbeddingsFieldName(fieldName, modelMetadata),
        fieldName,
        modelMetadata,
        startStatus,
        new Date().toISOString(),
    );
}

/**
 * Update the status of how the embeddings generation is going.
 */
export function updateEmbeddingsStatus(newStatus: EmbeddingsStatus, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): void {
    updateStatusByCollectionDestinationAndEmbName(
        collectionName,
        destinationCollectionName,
        getEmbeddingsFieldName(fieldName, modelMetadata),
        newStatus,
        new Date().toISOString()
    );
}

/**
 * Update embeddings status with a new status
 * @param embeddingsStatusDict
 * @param newStatus
 */
export function updateEmbeddingsStatusDict(embeddingsStatusDict: EmbeddingsState, newStatus: EmbeddingsStatus): void {
    updateEmbeddingsStatusByKey(
        embeddingsStatusDict._key,
        newStatus,
        new Date().toISOString()
    )
}
"use strict";
import {updateStatusByCollectionDestinationAndEmbName, updateEmbeddingsStatusByKey} from "../db/embeddings_status";
import {createStatus} from "../db/embeddings_status";
import {getStatusesByCollectionDestinationAndEmbName} from "../db/embeddings_status";
import {getEmbeddingsFieldName} from "./emb_collections_service";
import {EmbeddingsStatus, EmbeddingsState} from "../model/embeddings_status";

/**
 * Get the status of how the embeddings generation is going.
 */
// TODO: Replace any type
export function getEmbeddingsStatus(collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: any): EmbeddingsStatus {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length === 0) {
        return EmbeddingsStatus.DOES_NOT_EXIST;
    }
    return res[0]["status"];
}

/**
 * Get the document ID of an embedding status. Returns `undefined` if not found.
 */
// TODO: Replace any type + undefined
export function getEmbeddingsStatusDocId(collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: any): string | undefined {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length === 0) {
        return undefined;
    }
    return res[0]["_key"];
}

/**
 * Get the entire embedding status entry. Returns `undefined` if not found
 */
// TODO: Replace any type + undefined
export function getEmbeddingsStatusDict(collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: any): EmbeddingsState | undefined {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata))
    if (res.length === 0) {
        return undefined;
    }
    return res[0];
}

/**
 * Get or create embeddings status. New embeddings status will be initialized to DOES_NOT_EXIST
 */
// TODO: Replace any type
export function getOrCreateEmbeddingsStatusDict(graphName: string, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: any): EmbeddingsState {
    const res = getStatusesByCollectionDestinationAndEmbName(collectionName, destinationCollectionName, getEmbeddingsFieldName(fieldName, modelMetadata));
    if (res.length === 0) {
        return createEmbeddingsStatus(graphName, collectionName, destinationCollectionName, fieldName, modelMetadata, EmbeddingsStatus.DOES_NOT_EXIST);
    }
    return res[0];
}

/**
 * Create a new status of how the embeddings generation is going.
 */
// TODO: Replace any type
export function createEmbeddingsStatus(graphName: string, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: any, startStatus = EmbeddingsStatus.DOES_NOT_EXIST): EmbeddingsState {
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
// TODO: Replace any type
export function updateEmbeddingsStatus(newStatus: EmbeddingsStatus, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: any): void {
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
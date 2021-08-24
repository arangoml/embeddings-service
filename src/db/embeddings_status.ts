/**
 * This module is responsible for queries interacting with the Embeddings status metadata collection
 */
"use strict";
import {query, db} from "@arangodb";
import {EmbeddingsState, EmbeddingsStatus, embeddingsStatusCollectionName} from "../model/embeddings_status";

export function getStatusByKey(key: string) {
    const col = db._collection(embeddingsStatusCollectionName);
    const statuses = query`
    FOR d in ${col}
        FILTER d._key == ${key}
        RETURN d
    `.toArray();
    if (statuses.length === 0) {
        return null;
    }
    return statuses[0];
}

export function getStatusesByCollectionAndEmbName(collectionName: string, embeddingsFieldName: string): EmbeddingsState[] {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        RETURN d
    `.toArray();
}

export function getStatusesByCollectionDestinationAndEmbName(collectionName: string, destinationCollectionName: string, embeddingsFieldName: string): EmbeddingsState[] {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        RETURN d
    `.toArray();
}

// TODO: Remove Any from signature
export function createStatus(graphName: string, collectionName: string, destinationCollectionName: string, embeddingsFieldName: string, fieldName: string, modelMetadata: any, status: EmbeddingsStatus, timestamp: string): EmbeddingsState {
    const col = db._collection(embeddingsStatusCollectionName);
    if (graphName !== undefined && graphName.length > 0) {
        return query`
        INSERT {
            graph_name: ${graphName},
            model_key: ${modelMetadata["_key"]},
            model_type: ${modelMetadata["model_type"]},
            collection: ${collectionName},
            destination_collection: ${destinationCollectionName},
            emb_field_name: ${embeddingsFieldName},
            field_name: ${fieldName},
            status: ${status},
            last_run_timestamp: ${timestamp}
        } INTO ${col} RETURN NEW
        `.toArray()[0];
    } else {
        return query`
        INSERT {
            model_key: ${modelMetadata["_key"]},
            model_type: ${modelMetadata["model_type"]},
            collection: ${collectionName},
            destination_collection: ${destinationCollectionName},
            emb_field_name: ${embeddingsFieldName},
            field_name: ${fieldName},
            status: ${status},
            last_run_timestamp: ${timestamp}
        } INTO ${col} RETURN NEW
        `.toArray()[0];
    }
}

export function updateStatusByCollectionDestinationAndEmbName(collectionName: string, destinationCollectionName: string, embeddingsFieldName: string, newStatus: EmbeddingsStatus, timestamp: string): void {
    const col = db._collection(embeddingsStatusCollectionName);
    query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.destination_collection == ${destinationCollectionName}
        AND d.emb_field_name == ${embeddingsFieldName}
        UPDATE d._key WITH {
            status: ${newStatus},
            last_run_timestamp: ${timestamp} 
        } IN ${col}
    `;
}

export function updateEmbeddingsStatusByKey(embeddingsStatusKey: string, newStatus: EmbeddingsStatus, timestamp: string): EmbeddingsState {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    FOR d in ${col}
        FILTER d._key == ${embeddingsStatusKey}
        UPDATE d._key WITH {
            status: ${newStatus},
            last_run_timestamp: ${timestamp} 
        } IN ${col} RETURN NEW
    `.toArray()[0];
}

export function listEmbeddingsStatuses(): EmbeddingsState[] {
    const col = db._collection(embeddingsStatusCollectionName);
    return query`
    FOR d in ${col}
        RETURN d
    `.toArray();
}
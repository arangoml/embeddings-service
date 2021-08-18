"use strict";

import {context} from "@arangodb/locals";
import * as queues from "@arangodb/foxx/queues";
import {getCountEmbeddingsRunCollection, clearEmbeddingsRunCollection, createAndAddEmbeddingsRunCollection} from "./embeddings_run_service";
import {ModelMetadata, ModelTypes} from "../model/model_metadata";
import {EMB_QUEUE_NAME} from "../utils/embeddings_queue";
import {Queue} from "@arangodb/foxx/queues";
import {EmbeddingsState} from "../model/embeddings_status";

const embeddingQueueName = EMB_QUEUE_NAME;

export enum ScriptName {
    NODE = "createNodeEmbeddings",
    GRAPH = "createGraphEmbeddings"
};

export function queueBatch(
    scriptName: ScriptName,
    i: number,
    batchSize: number,
    numBatches: number,
    batchOffset: number,
    graphName: string | undefined,
    colName: string,
    fieldName: string,
    modelMetadata: ModelMetadata,
    embeddingsQueue: Queue,
    destinationCollection: string,
    separateCollection: boolean,
    embeddingsRunColName: string
): void {
    embeddingsQueue.push(
        {
            mount: context.mount,
            name: scriptName
        },
        {
            collectionName: colName,
            batchIndex: i,
            batchSize: batchSize,
            numberOfBatches: numBatches,
            batchOffset: batchOffset,
            modelMetadata: modelMetadata,
            graphName: graphName,
            fieldName: fieldName,
            destinationCollection: destinationCollection,
            separateCollection: separateCollection,
            embeddingsRunColName: embeddingsRunColName,
        }
    );
}

/**
 * Queue batch jobs to generate embeddings for a specified model/scriptType.
 * Returns true if batch jobs have been queued. This does NOT mean that they've succeeded yet.
 */
function generateBatches(scriptType: ScriptName, embeddingsState: EmbeddingsState, modelMetadata: ModelMetadata, overwriteExisting: boolean): boolean {
    // Create the embeddings run collection
    const embeddingsRunColName = createAndAddEmbeddingsRunCollection(embeddingsState, overwriteExisting);
    const numberOfDocuments = getCountEmbeddingsRunCollection(embeddingsState);

    if (numberOfDocuments === 0) {
        // Undo creation for this run
        clearEmbeddingsRunCollection(embeddingsState);
        return false;
    }

    const batch_size = 1000;
    const numBatches = Math.ceil(numberOfDocuments / batch_size);

    const embQ = queues.create(embeddingQueueName);

    // The queue will be invoked recursively
    queueBatch(
        scriptType,
        0,
        batch_size,
        numBatches,
        0,
        embeddingsState.graph_name,
        embeddingsState.collection,
        embeddingsState.field_name,
        modelMetadata,
        embQ,
        embeddingsState.destination_collection,
        embeddingsState.collection !== embeddingsState.destination_collection,
        embeddingsRunColName
    );
    return true;
}

export function generateBatchesForModel(embeddingsState: EmbeddingsState, modelMetadata: ModelMetadata, overwriteExisting = false): boolean {
    switch (modelMetadata.model_type) {
        case ModelTypes.WORD_EMBEDDING: {
            return generateBatches(ScriptName.NODE, embeddingsState, modelMetadata, overwriteExisting);
        }
        case ModelTypes.GRAPH_MODEL: {
            if (!graphName) {
                throw new Error("Requested to generate graph embeddings but no graph is provided");
            }
            return generateBatches(ScriptName.GRAPH, embeddingsState, modelMetadata, overwriteExisting);
        }
        default:
            throw new Error(`Error: unrecognized model type: ${modelMetadata.model_type}`);
    }
}
"use strict";

import * as queues from "@arangodb/foxx/queues";
import {context} from "@arangodb/locals";
import {getModelByKey} from "./model_metadata_service";
import {logMsg} from "../utils/logging";
import {manageEmbeddingsForDocFieldAndModel} from "./emb_management_service";
import {EmbeddingsState, EmbeddingsStatus} from "../model/embeddings_status";
import {listEmbeddingsStatuses} from "../db/embeddings_status";
import {ModelMetadata} from "../model/model_metadata";
import {Queue} from "@arangodb/foxx/queues";

const BACKGROUND_MANAGEMENT_QUEUE_NAME = "background_management_queue";
const BACKGROUND_MANAGEMENT_SCRIPT_NAME = "backgroundEmbeddingsManagement";

function getModelMetadataForEmbeddingsStatus(embeddingsState: EmbeddingsState): ModelMetadata | null {
    return getModelByKey(embeddingsState.model_key);
}

function manageEmbeddingsForStatusDict(embeddingsState: EmbeddingsState): void {
    const modelMetadata = getModelMetadataForEmbeddingsStatus(embeddingsState);
    if (modelMetadata === null) {
        logMsg(`Unable to find model ${embeddingsState.model_key}, skipping embeddings for ${embeddingsState.field_name} on ${embeddingsState.collection}`)
    } else {
        manageEmbeddingsForDocFieldAndModel(embeddingsState, modelMetadata, false);
    }
}

function shouldManageEmbeddingsStatus(embeddingsState: EmbeddingsState): boolean {
    switch (embeddingsState.status) {
        // Only update embeddings that are completed
        case EmbeddingsStatus.COMPLETED:
        case EmbeddingsStatus.FAILED:
            return true;
        default:
            return false;
    }
}

export function manageEmbeddingCollections(): void {
    listEmbeddingsStatuses()
        .filter(shouldManageEmbeddingsStatus)
        .forEach(manageEmbeddingsForStatusDict);
}

export function getBackgroundManagementQueue(): Queue {
    return queues.create(BACKGROUND_MANAGEMENT_QUEUE_NAME);
}

function cancelPendingQueueJobs(backQueue: Queue): void {
    backQueue.progress().forEach((jobId: string) => {
        backQueue.delete(jobId);
    })
    backQueue.pending().forEach((jobId: string) => {
        backQueue.delete(jobId);
    });
}

export function cancelBackgroundManagementJobs(): void {
    const backQueue = getBackgroundManagementQueue();
    cancelPendingQueueJobs(backQueue);
}

export function pushManagementQueueJob(backQueue: Queue): void {
    const intervalInMS = context.configuration.backgroundManagementInterval;
    backQueue.push(
        {
            mount: context.mount,
            name: BACKGROUND_MANAGEMENT_SCRIPT_NAME
        },
        {
            currentInterval: intervalInMS
        },
        {
            delayUntil: Date.now() + intervalInMS,
            repeatTimes: -1,
            repeatDelay: intervalInMS,
        }
    );
}

export function rescheduleManagementQueueJobIfNeeded(currentInterval: number): void {
    if (currentInterval !== context.configuration.backgroundManagementInterval) {
        console.log("Rescheduling management job")
        const backQueue = getBackgroundManagementQueue();
        cancelPendingQueueJobs(backQueue);
        pushManagementQueueJob(backQueue);
    }
}

export function canManageEmbeddings(): boolean {
    return context.configuration.enableQueues && context.configuration.enableBackgroundManagement;
}
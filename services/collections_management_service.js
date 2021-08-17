"use strict";

const queues = require("@arangodb/foxx/queues");
const {context} = require("@arangodb/locals");
const {getModelByKey} = require("../services/model_metadata_service");
const {logMsg} = require("../utils/logging");
const {manageEmbeddingsForDocFieldAndModel} = require("../services/emb_management_service");
const {embeddingsStatus} = require("../model/embeddings_status");
const {listEmbeddingsStatuses} = require("../db/embeddings_status");

const BACKGROUND_MANAGEMENT_QUEUE_NAME = "background_management_queue";
const BACKGROUND_MANAGEMENT_SCRIPT_NAME = "backgroundEmbeddingsManagement";

function getModelMetadataForEmbeddingsStatus(embeddingsStatusDict) {
    return getModelByKey(embeddingsStatusDict["model_key"]);
}

function manageEmbeddingsForStatusDict(embeddingsStatusDict) {
    const modelMetadata = getModelMetadataForEmbeddingsStatus(embeddingsStatusDict);
    if (modelMetadata === null) {
        logMsg(`Unable to find model ${embeddingsStatusDict["model_key"]}, skipping embeddings for ${embeddingsStatusDict["field_name"]} on ${embeddingsStatusDict["collection"]}`)
    }

    manageEmbeddingsForDocFieldAndModel(embeddingsStatusDict, embeddingsStatusDict["graph_name"], modelMetadata, false);
}

function shouldManageEmbeddingsStatus(embeddingsStatusDict) {
    switch (embeddingsStatusDict["status"]) {
        // Only update embeddings that are completed
        case embeddingsStatus.COMPLETED:
        case embeddingsStatus.FAILED:
            return true;
        default:
            return false;
    }
}

function manageEmbeddingCollections() {
    listEmbeddingsStatuses()
        .filter(shouldManageEmbeddingsStatus)
        .forEach(manageEmbeddingsForStatusDict);
}
function getBackgroundManagementQueue() {
    return queues.create(BACKGROUND_MANAGEMENT_QUEUE_NAME);
}

function cancelPendingQueueJobs(backQueue) {
    backQueue.progress().forEach((jobId) => {
        backQueue.delete(jobId);
    })
    backQueue.pending().forEach((jobId) => {
        backQueue.delete(jobId);
    });
}

function cancelBackgroundManagementJobs() {
    const backQueue = getBackgroundManagementQueue();
    cancelPendingQueueJobs(backQueue);
}

function pushManagementQueueJob(backQueue) {
    const intervalInMS = context.configuration.backgroundManagementInterval;
    backQueue.push(
        {
            mount: context.mount,
            name: BACKGROUND_MANAGEMENT_SCRIPT_NAME
        },
        {},
        {
            delayUntil: Date.now() + intervalInMS,
            repeatTimes: -1,
            repeatDelay: intervalInMS,
        }
    );
}

function rescheduleManagementQueueJob() {
    const backQueue = getBackgroundManagementQueue();
    // No way to cache previous management interval to compare, so must cancel if successful
    cancelPendingQueueJobs(backQueue);
    pushManagementQueueJob(backQueue);
}

function canManageEmbeddings() {
    return context.configuration.enableQueues && context.configuration.enableBackgroundManagement;
}

exports.pushManagementQueueJob = pushManagementQueueJob;
exports.getBackgroundManagementQueue = getBackgroundManagementQueue;
exports.canManageEmbeddings = canManageEmbeddings;
exports.manageEmbeddingCollections = manageEmbeddingCollections;
exports.rescheduleManagementQueueJob = rescheduleManagementQueueJob;
exports.cancelBackgroundManagementJobs = cancelBackgroundManagementJobs;
"use strict";

const {logMsg, logErr} = require("../utils/logging");
const {rescheduleManagementQueueJobIfNeeded, cancelBackgroundManagementJobs, manageEmbeddingCollections, canManageEmbeddings} = require("../services/collections_management_service");

const {argv} = module.context;

const {currentInterval} = argv[0];

if (canManageEmbeddings()) {
    try {
        manageEmbeddingCollections();
    } catch (e) {
        logErr("Error occured during embeddings management!");
        logErr(e, e.stack);
    } finally {
        rescheduleManagementQueueJobIfNeeded(currentInterval);
    }
} else {
    cancelBackgroundManagementJobs();
    logMsg("Background management queue disabled. If you would like to re-enable it - this script will need to be manually triggered");
}

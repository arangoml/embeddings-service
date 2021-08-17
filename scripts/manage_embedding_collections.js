"use strict";

const {logMsg, logErr} = require("../utils/logging");
const {rescheduleManagementQueueJob, cancelBackgroundManagementJobs, manageEmbeddingCollections, canManageEmbeddings} = require("../services/collections_management_service");


if (canManageEmbeddings()) {
    try {
        manageEmbeddingCollections();
    } catch (e) {
        logErr("Error occured during embeddings management!");
        logErr(e, e.stack);
    } finally {
        rescheduleManagementQueueJob();
    }
} else {
    cancelBackgroundManagementJobs();
    logMsg("Background management queue disabled. If you would like to re-enable it - this script will need to be manually triggered");
}

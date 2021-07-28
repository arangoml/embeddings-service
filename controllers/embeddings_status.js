const {getStatusByKey} = require("../db/embeddings_status");
const {getStatusesByCollectionAndEmbName} = require("../db/embeddings_status");
const {retrieveModel} = require("../services/model_metadata_service");
const {getEmbeddingsFieldName} = require("../services/emb_collections_service");
const {sendInvalidInputMessage} = require("../utils/invalid_input");

function embeddingsStatusesForModel(req, res) {
    const {modelName, modelType, collectionName, fieldName} = req.queryParams;
    const modelMetadata = retrieveModel(modelName, modelType);

    if (modelMetadata == null) {
        sendInvalidInputMessage(res,
            `Invalid model: ${modelName} of type ${modelType}`);
    }

    const statuses = getStatusesByCollectionAndEmbName(
        collectionName,
        getEmbeddingsFieldName(fieldName, modelMetadata)
    );

    if (statuses.length == 0) {
        res.throw(404, "Status not found");
    }
    res.json(statuses);
}

function embeddingsStatusById(req, res) {
    const {statusId} = req.pathParams;

    const status = getStatusByKey(statusId);
    if (status == null) {
        res.throw(404, "Status not found");
    }
    res.json(status);
}

exports.embeddingsStatusesForModel = embeddingsStatusesForModel;
exports.embeddingsStatusById = embeddingsStatusById;
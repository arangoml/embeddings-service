"use strict";

const {getCountDocumentsWithoutEmbedding} = require("../services/emb_collections_service");
const {getEmbeddingsStatusDict} = require("../services/emb_status_service");
const {checkCollectionIsPresent, checkGraphIsPresent} = require("../utils/db");
const {updateEmbeddingsStatus} = require("../services/emb_status_service");
const {modelTypes} = require("../model/model_metadata");
const {embeddingsStatus} = require("../model/embeddings_status");
const {sendInvalidInputMessage} = require("../utils/invalid_input");
const {retrieveModel} = require("../services/model_metadata_service");
const {getEmbeddingsStatus, createEmbeddingsStatus, getEmbeddingsStatusDocId} = require("../services/emb_status_service");
const {generateBatchesForModel} = require("../services/emb_generation_service");
const {getDestinationCollectionName} = require("../services/emb_collections_service");
const {profileCall} = require("../utils/profiling");

function initialValidationGenerateEmbParams(req, res) {
    // check if model type is valid
    if (!Object.values(modelTypes).some(v => v === req.body.modelType)) {
        sendInvalidInputMessage(res,
            `Invalid model type: ${req.body.modelType}, expected one of ${Object.values(modelTypes)}`);
    }

    // either but not both on collection
    if (!req.body.collectionName) {
        sendInvalidInputMessage(res,
            "Please supply a collectionName");
    }

    if (req.body.fieldName.length === 0) {
        sendInvalidInputMessage(res,
            "Please supply a fieldName to use for embeddings generation");
    }
}


function handleGenerationForModel(embStatusDict, graphName, sourceCollectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata, overwriteExisting) {
    const embStatus = embStatusDict ? embStatusDict["status"] : embeddingsStatus.DOES_NOT_EXIST;

    let response_dict = {};
    const start_msg = "Queued generation of embeddings!";

    switch (embStatus) {
        case embeddingsStatus.DOES_NOT_EXIST:
            const newEmbStatusDict = createEmbeddingsStatus(sourceCollectionName, destinationCollectionName, fieldName, modelMetadata);
            console.log(newEmbStatusDict);
            if (generateBatchesForModel(graphName, newEmbStatusDict, fieldName, separateCollection, modelMetadata)) {
                response_dict["message"] = start_msg;
            }
            break;
        case embeddingsStatus.FAILED:
            updateEmbeddingsStatus(embeddingsStatus.RUNNING, sourceCollectionName, destinationCollectionName, fieldName, modelMetadata);
            if (generateBatchesForModel(graphName, embStatusDict, fieldName, separateCollection, modelMetadata)) {
                response_dict["message"] = start_msg;
            }
            break;
        case embeddingsStatus.RUNNING:
        case embeddingsStatus.RUNNING_FAILED:
            if (overwriteExisting) {
                updateEmbeddingsStatus(embeddingsStatus.RUNNING, sourceCollectionName, destinationCollectionName, fieldName, modelMetadata);
                if (generateBatchesForModel(graphName, embStatusDict, fieldName, separateCollection, modelMetadata)) {
                    response_dict["message"] = "Overwriting old embeddings. " + start_msg;
                }
            } else {
                response_dict["message"] = "Generation of embeddings is already running!";
            }
            break;
        case embeddingsStatus.COMPLETED:
            // first check if we have any documents that don't already have an embedding
            if (!overwriteExisting) {
                if (getCountDocumentsWithoutEmbedding(embStatusDict, fieldName) !== 0) {
                    updateEmbeddingsStatus(embeddingsStatus.RUNNING, sourceCollectionName, destinationCollectionName, fieldName, modelMetadata);
                    if (generateBatchesForModel(graphName, embStatusDict, fieldName, separateCollection, modelMetadata)) {
                        response_dict["message"] = "Adding new embeddings. " + start_msg;
                    }
                } else {
                    response_dict["message"] = "These embeddings have already been generated!";
                }
            } else {
                updateEmbeddingsStatus(embeddingsStatus.RUNNING, sourceCollectionName, destinationCollectionName, fieldName, modelMetadata);
                if (generateBatchesForModel(graphName, embStatusDict, fieldName, separateCollection, modelMetadata)) {
                    response_dict["message"] = "Overwriting old embeddings. " + start_msg;
                }
            }
            break;
    }
    response_dict["embeddings_status_id"] = getEmbeddingsStatusDocId(sourceCollectionName, destinationCollectionName, fieldName, modelMetadata);
    return response_dict;
}

function generateEmbeddings(req, res) {
    initialValidationGenerateEmbParams(req, res);

    const {modelName, modelType, fieldName, graphName, collectionName, separateCollection, overwriteExisting} = req.body;

    // Check if the arguments are valid, either for word embeddings or graph embeddings
    if (!checkCollectionIsPresent(collectionName)) {
        sendInvalidInputMessage(res,
            `Collection named ${collectionName} does not exist.`);
    }

    if (graphName && !checkGraphIsPresent(graphName)) {
        sendInvalidInputMessage(res,
            `Graph named ${graphName} does not exist.`);
    }

    // retrieve model metadata from document
    const modelMetadata = retrieveModel(modelName, modelType);

    if (modelMetadata == null) {
        sendInvalidInputMessage(res,
            `Invalid model: ${modelName} of type ${modelType}`);
    }

    const destinationCollectionName = profileCall(getDestinationCollectionName)(collectionName, separateCollection, modelMetadata);
    const embStatusDict = profileCall(getEmbeddingsStatusDict)(collectionName, destinationCollectionName, fieldName, modelMetadata);
    const response_dict = profileCall(handleGenerationForModel)(embStatusDict, graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata, overwriteExisting);
    res.json(response_dict);
}

exports.generateEmbeddings = generateEmbeddings;
"use strict";

const {getCountDocumentsWithoutEmbedding, pruneEmbeddings} = require("../services/emb_collections_service");
const {getOrCreateEmbeddingsStatusDict, updateEmbeddingsStatusDict} = require("../services/emb_status_service");
const {checkCollectionIsPresent, checkGraphIsPresent} = require("../utils/db");
const {modelTypes} = require("../model/model_metadata");
const {embeddingsStatus} = require("../model/embeddings_status");
const {sendInvalidInputMessage} = require("../utils/invalid_input");
const {retrieveModel} = require("../services/model_metadata_service");
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

function pruneEmbeddingsIfNeeded(embeddingsStatusDict, overwriteExisting) {
    if (!overwriteExisting) {
        switch (embeddingsStatusDict["status"]) {
            case embeddingsStatus.DOES_NOT_EXIST:
            case embeddingsStatus.RUNNING:
            case embeddingsStatus.RUNNING_FAILED:
                // Don't need to prune in these cases
                return;
            default:
                // NOP
        }
    }
    pruneEmbeddings(embeddingsStatusDict);
}

function determineGenerationNeededForStatus(embeddingsStatusDict, overwriteExisting) {
    const start_msg = "Queued generation of embeddings!";
    let message = "";
    let shouldEmbed = true;

    switch (embeddingsStatusDict["status"]) {
        case embeddingsStatus.DOES_NOT_EXIST:
        case embeddingsStatus.FAILED:
            message = start_msg;
            break;
        case embeddingsStatus.RUNNING:
        case embeddingsStatus.RUNNING_FAILED:
            if (overwriteExisting) {
                message = "Overwriting old embeddings. " + start_msg;
            } else {
                shouldEmbed = false;
                message = "Generation of embeddings is already running!";
            }
            break;
        case embeddingsStatus.COMPLETED:
            // first check if we have any documents that don't already have an embedding
            if (!overwriteExisting) {
                if (getCountDocumentsWithoutEmbedding(embeddingsStatusDict, embeddingsStatusDict["field_name"]) !== 0) {
                    message = "Adding new embeddings. " + start_msg;
                } else {
                    shouldEmbed = false;
                    message = "These embeddings have already been generated!";
                }
            } else {
                message = "Overwriting old embeddings. " + start_msg;
            }
            break;
    }

    return {
        shouldGenerate: shouldEmbed,
        message: message
    };
}


function handleGenerationForModel(embStatusDict, graphName, sourceCollectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata, overwriteExisting) {
    let response_dict = {};

    pruneEmbeddingsIfNeeded(embStatusDict, overwriteExisting);

    const {shouldGenerate, message} = determineGenerationNeededForStatus(embStatusDict, overwriteExisting);
    response_dict["message"] = message;

    if (shouldGenerate) {
        updateEmbeddingsStatusDict(embStatusDict, embeddingsStatus.RUNNING);
        if (generateBatchesForModel(graphName, embStatusDict, fieldName, separateCollection, modelMetadata, overwriteExisting)) {
            // NOP
        } else {
            updateEmbeddingsStatusDict(embStatusDict, embeddingsStatus.COMPLETED);
            response_dict["message"] = "Nothing to embed.";
        }
    }

    response_dict["embeddings_status_id"] = embStatusDict["_key"];
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
    const embStatusDict = profileCall(getOrCreateEmbeddingsStatusDict)(collectionName, destinationCollectionName, fieldName, modelMetadata);
    const response_dict = profileCall(handleGenerationForModel)(embStatusDict, graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata, overwriteExisting);
    res.json(response_dict);
}

exports.generateEmbeddings = generateEmbeddings;
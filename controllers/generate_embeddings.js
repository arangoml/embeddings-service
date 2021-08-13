"use strict";

const {getOrCreateEmbeddingsStatusDict} = require("../services/emb_status_service");
const {checkCollectionIsPresent, checkGraphIsPresent} = require("../utils/db");
const {modelTypes} = require("../model/model_metadata");
const {sendInvalidInputMessage} = require("../utils/invalid_input");
const {retrieveModel} = require("../services/model_metadata_service");
const {getDestinationCollectionName} = require("../services/emb_collections_service");
const {profileCall} = require("../utils/profiling");
const {manageEmbeddingsForDocFieldAndModel} = require("../services/emb_management_service");

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
    const response_dict = profileCall(manageEmbeddingsForDocFieldAndModel)(embStatusDict, graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata, overwriteExisting);
    res.json(response_dict);
}

exports.generateEmbeddings = generateEmbeddings;
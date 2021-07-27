"use strict";

const {db} = require("@arangodb");
const graph_module = require("@arangodb/general-graph");
const {updateEmbeddingsStatus} = require("../services/emb_status_service");
const {modelTypes} = require("../model/model_metadata");
const {embeddingsStatus} = require("../model/embeddings_status");
const {sendInvalidInputMessage} = require("../utils/invalid_input");
const {retrieveModel} = require("../services/model_metadata_service");
const {getEmbeddingsStatus, createEmbeddingsStatus} = require("../services/emb_status_service");
const {generateBatchesForModel} = require("../services/emb_generation_service");
const {getDestinationCollectionName} = require("../services/emb_collections_service");

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

function checkGraphIsPresent(graphName) {
    return graph_module._list().some(g => g === graphName)
}

function checkCollectionIsPresent(collectionName) {
    return db._collections().map(c => c.name()).some(n => n === collectionName)
}

function handleGenerationForModel(embStatus, graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata) {
    switch (embStatus) {
        case embeddingsStatus.DOES_NOT_EXIST:
            createEmbeddingsStatus(collectionName, destinationCollectionName, fieldName, modelMetadata);
            return generateBatchesForModel(graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata);
        case embeddingsStatus.FAILED:
            return generateBatchesForModel(graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata);
        case embeddingsStatus.RUNNING:
        case embeddingsStatus.RUNNING_FAILED:
            return "Generation of embeddings is already running!";
        case embeddingsStatus.COMPLETED:
            // Overwrite by default
            updateEmbeddingsStatus(embStatus.RUNNING, collectionName, destinationCollectionName, fieldName, modelMetadata);
            return generateBatchesForModel(graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata);
        //     return "These embeddings have already been generated!";
    }
}

function generateEmbeddings(req, res) {
    initialValidationGenerateEmbParams(req, res);

    const {modelName, modelType, fieldName, graphName, collectionName, separateCollection} = req.body;

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

    const destinationCollectionName = getDestinationCollectionName(collectionName, separateCollection, modelMetadata);
    const embStatus = getEmbeddingsStatus(collectionName, destinationCollectionName, fieldName, modelMetadata);
    const message = handleGenerationForModel(embStatus, graphName, collectionName, fieldName, destinationCollectionName, separateCollection, modelMetadata)
    res.json(message);
}

exports.generateEmbeddings = generateEmbeddings;
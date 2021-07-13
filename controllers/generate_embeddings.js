const {db} = require("@arangodb");
const graph_module = require("@arangodb/general-graph");
const {modelTypes} = require("../model/model_metadata");
const {sendInvalidInputMessage} = require("../utils/invalid_input");
const {retrieveModel} = require("../services/model_metadata");
const {generateBatchesCollection, generateBatchesGraph} = require("../api/dispatcher");

function initialValidationGenerateEmbParams(req, res) {
    // check if model type is valid
    if (!Object.values(modelTypes).some(v => v === req.body.modelType)) {
        return sendInvalidInputMessage(res,
            `Invalid model type: ${req.body.modelType}, expected one of ${Object.values(modelTypes)}`);
    }

    // either but not both on collection
    if (!req.body.collectionName) {
        return sendInvalidInputMessage(res,
            "Please supply a collectionName");
    }

    if (req.body.fieldName.length === 0) {
        return sendInvalidInputMessage(res,
            "Please supply a fieldName to use for embeddings generation");
    }

    return true;
}

function checkGraphIsPresent(graphName) {
    return graph_module._list().some(g => g === graphName)
}

function checkCollectionIsPresent(collectionName) {
    return db._collections().map(c => c.name()).some(n => n === collectionName)
}

function generateEmbeddings(req, res) {
    if (!initialValidationGenerateEmbParams(req, res)) {
        return;
    }

    const {modelName, modelType, fieldName, graphName, collectionName} = req.body;
    // First retrieve model metadata from document
    const modelMetadata = retrieveModel(modelName, modelType)

    if (modelMetadata == null) {
        sendInvalidInputMessage(res,
            `Invalid model: ${modelName} of type ${modelType}`);
        return;
    }

    // Check if the arguments are valid, either for word embeddings or graph embeddings
    if (graphName && checkGraphIsPresent(graphName)) {
        if (checkCollectionIsPresent(collectionName)) {
            // Short circuit to collection creation if model is word embedding
            switch (modelMetadata.model_type) {
                case modelTypes.WORD_EMBEDDING:
                    generateBatchesCollection(res, collectionName, fieldName, modelMetadata);
                    break;
                case modelTypes.GRAPH_MODEL:
                    generateBatchesGraph(res, graphName, collectionName, fieldName, modelMetadata);
                    break;
                default:
                    throw new Error(`Error: unrecognized model type: ${modelMetadata.model_type}`);
            }
        } else {
            sendInvalidInputMessage(res,
                `Collection named ${collectionName} does not exist.`);
        }
    } else if (checkCollectionIsPresent(collectionName)) {
        generateBatchesCollection(res, collectionName, fieldName, modelMetadata);
    } else {
        sendInvalidInputMessage(res,
            `Graph or collection named ${collectionName | graphName} does not exist.`);
    }
}

exports.generateEmbeddings = generateEmbeddings;
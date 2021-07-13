const {db} = require("@arangodb");
const graph_module = require("@arangodb/general-graph");
const {modelTypes} = require("../model/model_metadata");

function sendInvalidInputMessage(res, message) {
    res.throw(422, message);
    return false;
}

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

exports.sendInvalidInputMessage = sendInvalidInputMessage;
exports.initialValidationGenerateEmbParams = initialValidationGenerateEmbParams;
exports.checkGraphIsPresent = checkGraphIsPresent;
exports.checkCollectionIsPresent = checkCollectionIsPresent;

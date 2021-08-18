"use strict";

import {getOrCreateEmbeddingsStatusDict} from "../services/emb_status_service";
import {checkCollectionIsPresent, checkGraphIsPresent} from "../utils/db";
import {ModelTypes} from "../model/model_metadata";
import {sendInvalidInputMessage} from "../utils/invalid_input";
import {retrieveModel} from "../services/model_metadata_service";
import {getDestinationCollectionName} from "../services/emb_collections_service";
import {profileCall} from "../utils/profiling";
import {manageEmbeddingsForDocFieldAndModel} from "../services/emb_management_service";
import Request = Foxx.Request;
import Response = Foxx.Response;

function initialValidationGenerateEmbParams(req: Request, res: Response): void {
    // check if model type is valid
    if (!Object.values(ModelTypes).some(v => v === req.body.modelType)) {
        sendInvalidInputMessage(res,
            `Invalid model type: ${req.body.modelType}, expected one of ${Object.values(ModelTypes)}`);
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

export function generateEmbeddings(req: Request, res: Response): void {
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
    const embStatusDict = profileCall(getOrCreateEmbeddingsStatusDict)(graphName, collectionName, destinationCollectionName, fieldName, modelMetadata);
    const response_dict = profileCall(manageEmbeddingsForDocFieldAndModel)(embStatusDict, modelMetadata, overwriteExisting);
    res.json(response_dict);
}
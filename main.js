"use strict";

const {context} = require("@arangodb/locals");
const createRouter = require("@arangodb/foxx/router");
const {query, db} = require("@arangodb");
const joi = require("joi");
const {modelTypes, metadataCollectionName} = require("./scripts/setup");

const router = createRouter();
context.use(router);


function retrieveModel(modelName, modelType) {
    const metadata_col = db._collection(metadataCollectionName);
    const model_info = query`
        FOR m in ${metadata_col}
        FILTER m.name == ${modelName}
        AND m.model_type == ${modelType}
        RETURN m
    `.toArray()

    if (model_info.length > 0) {
        return model_info[0];
    }
    // if we don't have a model, return null
    return null;
}

/**
 * Queue batch jobs to generate embeddings for a specified graph or collection.
 */
function generateBatches() {
    throw new Error("Implement me!");
}

function initialValidationGenerateEmbParams(req, res) {
    // check if model type is valid
    if (!Object.values(modelTypes).some(v => v == req.body.modelType)) {
        res.sendStatus(422);
        res.json(`Invalid model type: ${req.body.modelType}, expected one of ${Object.values(modelTypes)}`);
        return false;
    }

    // either but not both on collection
    if (req.body.collectionName.length > 0 && req.body.graphName.length > 0) {
        res.sendStatus(422);
        res.json(
            `Please supply one of either collectionName or graphName. Got both collectionName: ${req.body.collectionName}, graphName: ${req.body.graphName}`
        );
        return false;
    }
    if (req.body.collectionName.length === 0 && req.body.graphName.length === 0) {
        res.sendStatus(422);
        res.json("Please supply either a collectionName or graphName");
        return false;
    }

    return true;
}

router.post("/generate_embeddings", (req, res) => {

    const paramsValid = initialValidationGenerateEmbParams(req, res);
    if (!paramsValid) {
        return;
    }

    // First retrieve model metadata from document
    const modelMetadata = retrieveModel(req.body.modelName, req.body.modelType)

    if (modelMetadata == null) {
        res.sendStatus(422);
        res.json(`Invalid model: ${req.body.modelName} of type ${req.body.modelType}`);
        return;
    }

    // Check if the arguments are valid, either for word embeddings or graph embeddings
    // Word embeddings case, require field on document that should be embedded
    // Check with a quick AQL query that this is actually valid

    // Then once the schema has been validated, pass the arguments on to the generate batches function
    generateBatches();
}).body(
    joi.object({
        modelName: joi.string().required(),
        modelType: joi.string().required(),
        // should pick either one of these, but not both
        collectionName: joi.string(),
        graphName: joi.string(),
        // then pick field
        // (for graph embeddings this is a set of features, for word embeddings this is a text field)
        fieldName: joi.string().required()
    }).required()
);


router.get("/models", (_req, res) => {
    // Query the model metadata collection and return the results here!
    const metadata_col = db._collection(metadataCollectionName);
    const model_metadata = query`
        FOR m in ${metadata_col}
        RETURN {
            "name": m.name,
            "model_type": m.model_type,
            "emb_dim": m.emb_dim
        }
    `.toArray();
    res.json(model_metadata);
}).response(
    200,
    joi.array().items(
        joi.object({
            "name": joi.string(),
            "model_type": joi.string(),
            "emb_dim": joi.number()
        })
    )
);
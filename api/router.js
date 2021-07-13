"use strict";

const {query, db} = require("@arangodb");
const createRouter = require("@arangodb/foxx/router");
const joi = require("joi");
const {generateBatchesCollection, generateBatchesGraph} = require("./dispatcher");
const {
    retrieveModel,
    checkCollectionIsPresent,
    checkGraphIsPresent,
    sendInvalidInputMessage,
    initialValidationGenerateEmbParams
} = require("./validation");
const {metadataCollectionName, modelTypes} = require("../model/model_metadata");

function initRouter() {
    const router = createRouter();

    router.post("/generate_embeddings", (req, res) => {
        const paramsValid = initialValidationGenerateEmbParams(req, res);
        if (!paramsValid) {
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
                    `Collection named ${colName} does not exist.`);
            }
        } else if (checkCollectionIsPresent(collectionName)) {
            generateBatchesCollection(res, collectionName, fieldName, modelMetadata);
        } else {
            sendInvalidInputMessage(res,
                `Graph or collection named ${colName | graphName} does not exist.`);
        }
    }).body(
        joi.object({
            modelName: joi.string().required(),
            modelType: joi.string().required().allow(Object.values(modelTypes)),
            // should pick either one of these, but not both
            collectionName: joi.string().required(),
            graphName: joi.string(),
            // then pick field
            // (for graph embeddings this is a set of features, for word embeddings this is a text field)
            fieldName: joi.string().required()
        }).required(),
        // This seems to be encased in a "value" object in the swagger doc
        // .example([{
        //     modelName: "distilbert-base-uncased",
        //     modelType: modelTypes.WORD_EMBEDDING,
        //     collectionName: "imdb_vertices",
        //     fieldName: "description"
        // }])
        ["application/json"],
        `This endpoint triggers the creation of embeddings for a specified collection or graph.
         You will need to provide the name and type of an embedding model (available models can be listed using the \`/models\` endpoint.
         Body required:
         \`modelName\`: name of the model
         \`modelType\`: type of the model. Currently supported: ${Object.values(modelTypes).map(v => `\`${v}\``)}
         \`collectionName\`: name of the collection that you want to embed
         \`graphName\`: name of the graph that you want to embed (please note: not required if generating node specific features e.g. word embeddings)
         \`fieldName\`: name of the field to embed. For graph embeddings this is a feature vector, for word embeddings this is a string.
         `
    ).response(
        400,
        "Improperly formatted input"
    ).response(
        422,
        joi.string(),
        "Invalid input"
    ).response(200, joi.string());

    router.get("/models", (_req, res) => {
        // Query the model metadata collection and return the results here!
        const metadata_col = db._collection(metadataCollectionName);
        const model_metadata = query`
        FOR m in ${metadata_col}
        RETURN {
            "name": m.name,
            "model_type": m.model_type,
            "emb_dim": m.metadata.emb_dim
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

    return router;
}

exports.initRouter = initRouter;
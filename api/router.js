"use strict";

const createRouter = require("@arangodb/foxx/router");
const joi = require("joi");
const {listModels} = require("../controllers/list_models");
const {generateEmbeddings} = require("../controllers/generate_embeddings");
const {modelTypes} = require("../model/model_metadata");

const router = createRouter();

router.post("/generate_embeddings", generateEmbeddings)
    .body(
        joi.object({
            modelName: joi.string().required(),
            modelType: joi.string().required().allow(Object.values(modelTypes)),
            // should pick either one of these, but not both
            collectionName: joi.string().required(),
            graphName: joi.string(),
            // then pick field
            // (for graph embeddings this is a set of features, for word embeddings this is a text field)
            fieldName: joi.string().required(),
            separateCollection: joi.bool().default(true)
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
         \`separateCollection\`: whether or not to store embeddings in a separate collection - \`true\` by default. If set to false, the embeddings
         \twill be stored on the documents in the specified collection.
         `
    ).response(
        400,
        "Improperly formatted input"
    ).response(
        422,
        joi.string(),
        "Invalid input"
    ).response(200, joi.string());

router.get("/models", listModels)
    .response(
        200,
        joi.array().items(
            joi.object({
                "name": joi.string(),
                "model_type": joi.string(),
                "emb_dim": joi.number()
            })
        )
    );

exports.router = router;
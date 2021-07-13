"use strict";

const {query, db} = require("@arangodb");
const createRouter = require("@arangodb/foxx/router");
const joi = require("joi");
const {generateEmbeddings} = require("../controllers/generate_embeddings");
const {metadataCollectionName, modelTypes} = require("../model/model_metadata");

const router = createRouter();

router.post("/generate_embeddings", generateEmbeddings).body(
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

exports.router = router;
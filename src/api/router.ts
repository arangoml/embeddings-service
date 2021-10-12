"use strict";

import {retrieveNearestNeighbors} from "../controllers/retrieve_nearest_neighbors";

const createRouter = require("@arangodb/foxx/router");
import * as joi from "joi";
import {listModels} from "../controllers/list_models";
import {generateEmbeddings} from "../controllers/generate_embeddings";
import {embeddingsStatusesForModel, embeddingsStatusById} from "../controllers/embeddings_status";
import {retrieveEmbeddings} from "../controllers/retrieve_embeddings";
import {ModelTypes} from "../model/model_metadata";

export const router = createRouter();

router.post("/embeddings", retrieveEmbeddings)
    .body(
        joi.object({
            modelName: joi.string().required(),
            modelType: joi.string().required().allow(Object.values(ModelTypes)),
            collectionName: joi.string().required(),
            fieldName: joi.string().required(),
            documentKeys: joi.array().items(joi.string()).required(),
            fields: joi.array().default([]),
            labelMapping: joi.array().items(joi.string()),
            fullDocuments: joi.bool().default(false)
        })
    );

router.post("/nearest_neighbors", retrieveNearestNeighbors)
    .body(
        joi.object({
            modelName: joi.string().required(),
            modelType: joi.string().required().allow(Object.values(ModelTypes)),
            collectionName: joi.string().required(),
            fieldName: joi.string().required(),
            documentKey: joi.string().required(),
            fullDocuments: joi.bool().default(false),
            fields: joi.array().default([]),
            numberOfNeighbors: joi.number().required()
        })
    );

router.post("/generate_embeddings", generateEmbeddings)
    .body(
        joi.object({
            modelName: joi.string().required(),
            modelType: joi.string().required().allow(Object.values(ModelTypes)),
            // should pick either one of these, but not both
            collectionName: joi.string().required(),
            graphName: joi.string(),
            // then pick field
            // (for graph embeddings this is a set of features, for word embeddings this is a text field)
            fieldName: joi.string().required(),
            separateCollection: joi.bool().default(true),
            overwriteExisting: joi.bool().default(false),
            documentKeys: joi.array().items(joi.string()).default([])
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
         \`modelType\`: type of the model. Currently supported: ${Object.values(ModelTypes).map(v => `\`${v}\``)}
         \`collectionName\`: name of the collection that you want to embed
         \`graphName\`: name of the graph that you want to embed (please note: not required if generating node specific features e.g. word embeddings)
         \`fieldName\`: name of the field to embed. For graph embeddings this is a feature vector, for word embeddings this is a string.
         \`separateCollection\`: whether or not to store embeddings in a separate collection - \`true\` by default. If set to false, the embeddings
         \twill be stored on the documents in the specified collection.
         \`overwriteExisting\`: \`false\` by default. If set to \`true\` then this will overwrite existing embeddings for the collection+field+model combination
         \t if it exists.
         \`documentKeys\`: Specific list of documents to embed within a specified collection. This will only embed the specific documents and will not
         \t embed/maintain embeddings for other documents, unless these documents are already embedded. If you would like to embed the remaining documents within a 
         \t collection, then requesting generation without this key will remove the filter & embed the entire collection.
         `
    ).response(
        400,
        "Improperly formatted input"
    ).response(
        422,
        joi.string(),
        ["application/json"],
        "Invalid input"
    ).response(200,
        joi.object({
            message: joi.string(),
            embeddings_status_id: joi.string()
        })
    );

router.get("/embeddings_status/:statusId", embeddingsStatusById)
    .pathParam("statusId", joi.string().required(), "ID of embeddings generation status")
    .response(
        404,
        joi.string(),
        ["application/json"],
        "Not found"
    )
    .response(200,
        joi.object({
            status: joi.string(),
            documentCollection: joi.string(),
            embeddingsCollection: joi.string(),
            embeddingsFieldName: joi.string()
        })
    );

router.get("/embeddings_status", embeddingsStatusesForModel)
    .queryParam("modelName", joi.string().required())
    .queryParam("modelType", joi.string().required())
    .queryParam("collectionName", joi.string().required())
    .queryParam("fieldName", joi.string().required())
    .response(
        404,
        joi.string(),
        ["application/json"],
        "Not found"
    )
    .response(200,
        joi.object({
            status: joi.string(),
            documentCollection: joi.string(),
            embeddingsCollection: joi.string(),
            embeddingsFieldName: joi.string()
        })
    );

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

// exports.router = router;
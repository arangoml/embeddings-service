"use strict";

const {context} = require("@arangodb/locals");
const createRouter = require("@arangodb/foxx/router");
const {query, db} = require("@arangodb");
const graph_module = require("@arangodb/general-graph");
const queues = require("@arangodb/foxx/queues");
const joi = require("joi");
const {modelTypes, metadataCollectionName} = require("./scripts/setup");

const router = createRouter();
context.use(router);

// TODO: Make this model specific?
const batch_size = 64;
exports.BATCH_SIZE = batch_size;

const embeddingQueueName = "embeddings_generation";

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

function sendInvalidInputMessage(res, message) {
    res.sendStatus(422);
    res.json(message);
    return false
}

function initialValidationGenerateEmbParams(req, res) {
    // check if model type is valid
    if (!Object.values(modelTypes).some(v => v === req.body.modelType)) {
        return sendInvalidInputMessage(res,
            `Invalid model type: ${req.body.modelType}, expected one of ${Object.values(modelTypes)}`);
    }

    // either but not both on collection
    if (req.body.collectionName && req.body.graphName && req.body.collectionName.length > 0 && req.body.graphName.length > 0) {
        return sendInvalidInputMessage(res,
            `Please supply one of either collectionName or graphName. Got both collectionName: ${req.body.collectionName}, graphName: ${req.body.graphName}`
        );
    }
    if (!(req.body.collectionName || req.body.graphName)) {
        return sendInvalidInputMessage(res,
            "Please supply either a collectionName or graphName");
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

function queueCollectionBatch(i, batchSize, colName, fieldName, modelMetadata, embeddingsQueue) {
    embeddingsQueue.push(
        {
            mount: context.mount,
            name: "createEmbeddings"
        },
        {
            collectionName: colName,
            batchInd: i,
            modelMetadata,
            fieldName,
            batchSize
        }
    );
}

/**
 * Queue batch jobs to generate embeddings for a specified collection.
 */
function generateBatchesCollection(res, colName, fieldName, modelMetadata) {
    const myCol = db._collection(colName);
    const numberOfDocuments = query`
    RETURN COUNT(
        FOR doc in ${myCol}
        FILTER doc.${fieldName} != null
        RETURN 1
    )
    `.toArray();
    console.log(numberOfDocuments[0]);

    const numBatches = Math.ceil(numberOfDocuments / batch_size);

    const embQ = queues.create(embeddingQueueName);

    Array(numBatches)
        .fill()
        .map((_, i) => i)
        .forEach(i => queueCollectionBatch(i, batch_size, colName, fieldName, modelMetadata, embQ));

    res.sendStatus(200);
    res.json(`Queued generation of embeddings for collection ${colName} using ${modelMetadata.name} on the ${fieldName} field`);
}

/**
 * Queue batch jobs to generate embeddings for a specified graph.
 */
function generateBatchesGraph(res, graphName, fieldName, modelMetadata) {
    throw new Error("Implement me!");
}


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
        throw new Error("Implement graph support");
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
            collectionName: joi.string(),
            graphName: joi.string(),
            // then pick field
            // (for graph embeddings this is a set of features, for word embeddings this is a text field)
            fieldName: joi.string().required()
        }).required()
            // This seems to be encased in a "value" object in the swagger doc
            // .example([{
            //     modelName: "distilbert-base-uncased",
            //     modelType: modelTypes.WORD_EMBEDDING,
            //     collectionName: "imdb_vertices",
            //     fieldName: "description"
            // }])
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
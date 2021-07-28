const {query, db} = require("@arangodb");
const {embeddingsStatusCollectionName} = require("../model/embeddings_status");
const {retrieveModel} = require("../services/model_metadata_service");
const {getEmbeddingsFieldName} = require("../services/emb_collections_service");
const {sendInvalidInputMessage} = require("../utils/invalid_input");

function embeddingsStatusesForModel(req, res) {
    const {modelName, modelType, collectionName, fieldName} = req.queryParams;
    const modelMetadata = retrieveModel(modelName, modelType);

    if (modelMetadata == null) {
        sendInvalidInputMessage(res,
            `Invalid model: ${modelName} of type ${modelType}`);
    }

    const col = db._collection(embeddingsStatusCollectionName);
    const statuses = query`
    FOR d in ${col}
        FILTER d.collection == ${collectionName}
        AND d.emb_field_name == ${getEmbeddingsFieldName(fieldName, modelMetadata)}
        RETURN d
    `.toArray();
    if (statuses.length == 0) {
        res.throw(404, "Status not found");
    }
    res.json(statuses);
}

function embeddingsStatusById(req, res) {
    const {statusId} = req.pathParams;

    const col = db._collection(embeddingsStatusCollectionName);
    const statuses = query`
    FOR d in ${col}
        FILTER d._key == ${statusId}
        RETURN d
    `.toArray();
    if (statuses.length == 0) {
        res.throw(404, "Status not found");
    }
    res.json(statuses[0]);
}

exports.embeddingsStatusesForModel = embeddingsStatusesForModel;
exports.embeddingsStatusById = embeddingsStatusById;
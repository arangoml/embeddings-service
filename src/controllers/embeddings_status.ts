"use strict";
import {getStatusByKey} from "../db/embeddings_status";
import {getStatusesByCollectionAndEmbName} from "../db/embeddings_status";
import {retrieveModel} from "../services/model_metadata_service";
import {getEmbeddingsFieldName} from "../services/emb_collections_service";
import {sendInvalidInputMessage} from "../utils/invalid_input";
import Request = Foxx.Request;
import Response = Foxx.Response;

export function embeddingsStatusesForModel(req: Request, res: Response): void {
    const {modelName, modelType, collectionName, fieldName} = req.queryParams;
    const modelMetadata = retrieveModel(modelName, modelType);

    if (modelMetadata == null) {
        sendInvalidInputMessage(res,
            `Invalid model: ${modelName} of type ${modelType}`);
    } else {

        const statuses = getStatusesByCollectionAndEmbName(
            collectionName,
            getEmbeddingsFieldName(fieldName, modelMetadata)
        );

        if (statuses.length === 0) {
            res.throw(404, "Status not found");
        }
        res.json(statuses);
    }
}

export function embeddingsStatusById(req: Request, res: Response): void {
    const {statusId} = req.pathParams;

    const status = getStatusByKey(statusId);
    if (status == null) {
        res.throw(404, "Status not found");
    }
    res.json(status);
}

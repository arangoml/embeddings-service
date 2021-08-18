"use strict";

import {query, db} from "@arangodb";
import {metadataCollectionName, ModelMetadata, ModelTypes} from "../model/model_metadata";

/**
 * Retrieve a model's metadata from the model metadata collection,
 * given its name and type. If a model is not found, null will be returned.
 * @param modelName
 * @param modelType
 * @returns {null|*}
 */
export function retrieveModel(modelName: string, modelType: ModelTypes) {
    const metadata_col = db._collection(metadataCollectionName);
    const model_info = query`
        FOR m in ${metadata_col}
        FILTER m.name == ${modelName}
        AND m.model_type == ${modelType}
        RETURN m
    `.toArray();

    if (model_info.length > 0) {
        return model_info[0];
    }
    // if we don't have a model, return null
    return null;
}

export function getModelByKey(modelKey: string): ModelMetadata | null {
    const metadata_col = db._collection(metadataCollectionName);
    const model_info = query`
        FOR m in ${metadata_col}
        FILTER m._key == ${modelKey}
        RETURN m
    `.toArray();

    if (model_info.length > 0) {
        return model_info[0];
    }
    // if we don't have a model, return null
    return null;
}

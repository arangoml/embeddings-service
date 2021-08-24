"use strict";

import {query, db} from "@arangodb";
import {metadataCollectionName} from "../model/model_metadata";
import Request = Foxx.Request;
import Response = Foxx.Response;

export function listModels(_req: Request, res: Response) {
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
}
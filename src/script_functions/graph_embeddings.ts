"use strict";

import {ModelMetadata} from "../model/model_metadata";
import {getEmbeddingsFieldName} from "../services/emb_collections_service";
import {query} from "@arangodb";
import Collection = ArangoDB.Collection;

export interface TargetDoc {
    _key: string;
    field: any;
}

export interface TraversalResult {
    node: TargetDoc;
    neighbors?: TraversalResult[];
}

export function flattenTraversalResult(t: TraversalResult, number_of_hops: number): { features: any[]; adj_lists: number[][][] } {
    let q: { v: TraversalResult, s_ind: number, level: number }[] = [{v: t, s_ind: 0, level: -1}];

    const features = []
    const adj_lists: number[][][] = [];

    while (q.length !== 0) {
        const res = q.shift();
        if (res !== undefined) {
            const this_ind = features.length;

            features.push(res.v.node.field);

            if (adj_lists.length == res.level) {
                adj_lists.push([]);
            }

            if (res.level !== -1) {
                adj_lists[res.level].push([this_ind, res.s_ind]);
            }

            if (res.v.neighbors !== undefined) {
                res.v.neighbors.forEach((neighbor) => {
                    q.push({
                        v: neighbor,
                        s_ind: this_ind,
                        level: res.level + 1
                    });
                });
            }
        }
    }


    for (let i = 0; i < number_of_hops; i++) {
        if (i > 0) {
            const clone = Array.from(adj_lists[i - 1].map(m => Array.from(m)))
            adj_lists[i].push(...clone);
        }
    }

    return {
        features,
        adj_lists
    };
}

export function insertGraphEmbeddingsIntoDBSameCollection(docsWithKey: TraversalResult[], calculatedEmbeddings: number[][], fieldName: string, collection: Collection, modelMetadata: ModelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return {
            "_key": x.node._key,
            "embedding": calculatedEmbeddings[i],
            "field_data": x.node.field
        };
    });

    const embedding_field_name = getEmbeddingsFieldName(fieldName, modelMetadata);
    const field_hash_name = `${embedding_field_name}_hash`;

    query`
    FOR doc in ${docs}
      UPDATE {
        _key: doc["_key"]
      } WITH {
        ${embedding_field_name}: doc["embedding"],
        ${field_hash_name}: SHA1(doc["field_data"])
      } IN ${collection}
    `
}

export function insertGraphEmbeddingsIntoDBSepCollection(docsWithKey: TraversalResult[], calculatedEmbeddings: number[][], fieldName: string, dCollection: Collection, modelMetadata: ModelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return {
            "_key": x.node.field,
            "embedding": calculatedEmbeddings[i],
            "emb_key": `emb_${x.node._key}`,
            "field_data": x.node.field
        };
    });

    const embedding_field_name = getEmbeddingsFieldName(fieldName, modelMetadata);
    const field_hash_name = `${embedding_field_name}_hash`;

    query`
    FOR doc in ${docs}
      UPSERT {
        _key: doc["emb_key"],
      }
      INSERT {
        _key: doc["emb_key"],
        doc_key: doc["_key"],
        ${embedding_field_name}: doc["embedding"],
        ${field_hash_name}: SHA1(doc["field_data"])
      }
      UPDATE {
        ${embedding_field_name}: doc["embedding"],
        ${field_hash_name}: SHA1(doc["field_data"])
      } IN ${dCollection}
    `;
}

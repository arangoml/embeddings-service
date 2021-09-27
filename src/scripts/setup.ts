"use strict";

import Collection = ArangoDB.Collection;

const db = require("@arangodb").db;
import {ModelTypes, metadataCollectionName, modelMetadataSchema, FieldType} from "../model/model_metadata";
import {embeddingsStatusCollectionName, embeddingsStatusSchema} from "../model/embeddings_status";
import {pushManagementQueueJob, getBackgroundManagementQueue} from "../services/collections_management_service";
import {logMsg} from "../utils/logging";
import {Queue} from "@arangodb/foxx/queues";


function createModelMetadataCollection() {
    if (!db._collection(metadataCollectionName)) {
        db._createDocumentCollection(metadataCollectionName, { "schema": modelMetadataSchema });
    }
    return db._collection(metadataCollectionName);
}

function createEmbeddingsStatusCollection() {
    if (!db._collection(embeddingsStatusCollectionName)) {
        db._createDocumentCollection(embeddingsStatusCollectionName, { "schema": embeddingsStatusSchema });
    }
    return db._collection(embeddingsStatusCollectionName);
}

const seedData = [
    {
        model_type: ModelTypes.WORD_EMBEDDING,
        name: "paraphrase-mpnet-base-v2",
        _key: "paraphrase-mpnet-base-v2",
        framework: {
            name: "pytorch",
            version: "1.9.0"
        },
        website: "https://www.sbert.net/docs/pretrained_models.html",
        invocation: {
            // This is the name that this model will have on the compute node. May differ from display name
            invocation_name: "word_embeddings",
            emb_dim: 768,
            inference_batch_size: 64,
            input: {
                kind: "field",
                field_type: FieldType.TEXT,
                input_key: "INPUT0"
            },
            output: {
                output_key: "OUTPUT0"
            }
        },
        data: [ // A list of the datasets that were used during training
            // modification of the MLSpec - MLSpec has a single data source specified
            // {
            //     source_id: "BOOK-CORPUS",
            //     domain: "text",
            //     website: "https://yknzhu.wixsite.com/mbweb"
            // },
            // {
            //     source_id: "EN-Wikipedia",
            //     domain: "text",
            //     website: "https://en.wikipedia.org/wiki/English_Wikipedia"
            // }
        ],
        metadata: {
            schema: {
                type: "RAW/TEXT",
            }
        }
    },
    {
        model_type: ModelTypes.GRAPH_MODEL,
        name: "graphsage_obgn_products",
        _key: "graphsage_obgn_products",
        framework: {
            name: "pytorch",
            version: "1.9.0"
        },
        invocation: {
            invocation_name: "graphsage_obgn_products",
            emb_dim: 47,
            inference_batch_size: 1,
            input: {
                kind: "graph",
                neighborhood: {
                    number_of_hops: 3,
                    samples_per_hop: [15, 10, 5]
                },
                feature_dim: 256,
                features_input_key: "input__0",
                adjacency_list_input_keys: ["input__5", "input__3", "input__1"],
                adjacency_size_input_keys: ["input__6", "input__4", "input__2"]
            },
            output: {
                output_key: "output__2",
                index: 0
            }
        },
        data: [
            {
                source_id: "AMAZON-PRODUCT-CoPurchase",
                domain: "graph",
                website: "https://snap.stanford.edu/data/amazon0601.html"
            }
        ],
        train: {
            // hyper-parameters etc
            training_params: [
                {learning_rate: 0.01},
                {loss: "cross-entropy"},
                {batch_size: 64},
                {epochs: 50},
            ]
        },
        metadata: {
            schema: {
                features: ["bag_of_words"],
                type: "NUMERIC",
                input_shape: [256, 1],
            },
            metrics: [
                {
                    key: "mrr",
                    value: 0.567,
                    value_type: "NUMBER"
                }
            ],
        }
    }
];

function seedMetadataCol(collection: Collection): void {
    collection.insert(seedData);
}

function backgroundQueueSize(backQueue: Queue): number {
    return backQueue.progress().length + backQueue.pending().length;
}

const modelMetadataCol = createModelMetadataCollection();
seedMetadataCol(modelMetadataCol);
createEmbeddingsStatusCollection();

const backQueue = getBackgroundManagementQueue();

if (backgroundQueueSize(backQueue) < 1) {
    logMsg("starting background embeddings management.");
    pushManagementQueueJob(backQueue);
}
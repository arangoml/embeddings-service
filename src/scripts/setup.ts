"use strict";

import Collection = ArangoDB.Collection;

const db = require("@arangodb").db;
import {ModelTypes, metadataCollectionName, modelMetadataSchema} from "../model/model_metadata";
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
        // This is the name that this model will have on the compute node. May differ from display name
        invocation_name: "word_embeddings",
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
            emb_dim: 768,
            inference_batch_size: 64,
            schema: {
                type: "RAW/TEXT",
            }
        }
    },
    {
        model_type: ModelTypes.GRAPH_MODEL,
        name: "graph-sage",
        _key: "graph-sage",
        framework: {
            name: "pytorch",
            version: "1.9.0"
        },
        invocation_name: "graph-sage",
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
            emb_dim: 256,
            inference_batch_size: 64,
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
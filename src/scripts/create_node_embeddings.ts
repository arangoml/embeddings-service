"use strict";
import Collection = ArangoDB.Collection;

const queues = require("@arangodb/foxx/queues");
import {query, db} from "@arangodb";
import {profileCall} from "../utils/profiling";
import {context} from "@arangodb/locals";
import {logErr} from "../utils/logging";
import {logMsg} from "../utils/logging";
import {getEmbeddingsFieldName} from "../services/emb_collections_service";
import {getEmbeddingsStatus, updateEmbeddingsStatus} from "../services/emb_status_service";
import {queueBatch, ScriptName} from "../services/emb_generation_service";
import {EmbeddingsStatus} from "../model/embeddings_status";
import {EMB_QUEUE_NAME} from "../utils/embeddings_queue";
import {embeddingsTargetsAreValid} from "../utils/embeddings_target";
import {ModelMetadata} from "../model/model_metadata";
import {GenerationJobInputArgs} from "../utils/generation_job_input_args";
import {invokeEmbeddingModel} from "../utils/invocation";

const {argv} = module.context;

const {batchIndex, batchSize, numberOfBatches, batchOffset, collectionName, modelMetadata, fieldName, destinationCollection, separateCollection, embeddingsRunColName}: GenerationJobInputArgs = argv[0];
const isLastBatch = (batchIndex >= (numberOfBatches - 1));

const MAX_RETRIES = 5;

interface TargetDocument {
    _key: string;
    field: any
}

function getDocumentsToEmbed(nDocs: number, startInd: number, docCollection: Collection, embeddingsRunCol: Collection, fieldToEmbed: string): TargetDocument[] {
    return query`
        FOR embRunDoc in ${embeddingsRunCol}
            LIMIT ${startInd}, ${nDocs}
            FOR doc in ${docCollection}
                FILTER embRunDoc._key == doc._key
                FILTER doc.${fieldToEmbed} != null
                RETURN {
                  "_key": doc._key,
                  "field": doc.${fieldToEmbed}
                }
    `.toArray();
}

function formatBatch(batchData: any[]) {
    return {
        inputs: [
            {
                name: "INPUT0",
                data: batchData,
                shape: [batchData.length],
                datatype: "BYTES"
            }
        ]
    };
}

function callModel(dataToEmbed: any[]) {
    const requestBody = formatBatch(dataToEmbed);
    return invokeEmbeddingModel(requestBody, context.configuration.embeddingService, modelMetadata.invocation.invocation_name, MAX_RETRIES);
}

function chunkArray(array: any[], chunk_size: number) {
    return Array(Math.ceil(array.length / chunk_size))
        .fill(0)
        .map((_, i) => i * chunk_size)
        .map(begin => array.slice(begin, begin + chunk_size));
}

function extractEmbeddingsFromResponse(response_json: any, embedding_dim: number) {
    // N.B. this is brittle, do output formats differ per model?
    const output = JSON.parse(response_json);
    const giant_arr = output["outputs"][0]["data"];
    return chunkArray(giant_arr, embedding_dim);
}

function logTimeElapsed(response_json: any) {
    if (context.configuration.enableProfiling === false) {
        return;
    }
    const output = JSON.parse(response_json);
    output["outputs"]
        .filter((e: any) => e["name"].startsWith("TIME"))
        .forEach((e: any) => {
            logMsg(`Model call ${e["name"]} on compute node took ${e["data"]} ms`);
        });
}

function insertEmbeddingsIntoDBSameCollection(docsWithKey: TargetDocument[], calculatedEmbeddings: number[][], fieldName: string, collection: Collection, modelMetadata: ModelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return {
            "_key": x["_key"],
            "embedding": calculatedEmbeddings[i],
            "field_data": x["field"]
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

function insertEmbeddingsIntoDBSepCollection(docsWithKey: TargetDocument[], calculatedEmbeddings: number[][], fieldName: string, dCollection: Collection, modelMetadata: ModelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return {
            "_key": x["_key"],
            "embedding": calculatedEmbeddings[i],
            "emb_key": `emb_${x["_key"]}`,
            "field_data": x["field"]
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

function handleFailure(currentBatchFailed: boolean, isTheLastBatch: boolean, collectionName: string, destinationCollectionName: string, fieldName: string, modelMetadata: ModelMetadata): void {
    if (currentBatchFailed) {
        updateEmbeddingsStatus(EmbeddingsStatus.RUNNING_FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
    }

    if (isTheLastBatch) {
        updateEmbeddingsStatus(EmbeddingsStatus.FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
    }
}

function getAndSaveNodeEmbeddingsForMiniBatch(collection: Collection, dCollection: Collection): (miniBatch: TargetDocument[]) => void {
    return function (miniBatch: TargetDocument[]) {
        const requestData = miniBatch.map(x => x.field);
        const res = profileCall(callModel)(requestData);

        if (res.status === 200) {
            logTimeElapsed(res.body);
            const embeddings = profileCall(extractEmbeddingsFromResponse)(res.body, modelMetadata.invocation.emb_dim);
            if (separateCollection) {
                profileCall(insertEmbeddingsIntoDBSepCollection)(miniBatch, embeddings, fieldName, dCollection, modelMetadata);
            } else {
                profileCall(insertEmbeddingsIntoDBSameCollection)(miniBatch, embeddings, fieldName, collection, modelMetadata);
            }
        } else {
            logErr("Failed to get requested embeddings for minibatch");
            handleFailure(true, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
        }
    }
}

function createNodeEmbeddings(): void {
    try {
        // Actual processing done here
        logMsg(`Create embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} using ${modelMetadata.name} on the ${fieldName} field`);
        const collection = db._collection(collectionName)
        let dCollection;
        if (separateCollection) {
            dCollection = db._collection(destinationCollection);
        } else {
            dCollection = collection;
        }

        const embeddingsRunCol = db._collection(embeddingsRunColName);
        const toEmbed = profileCall(getDocumentsToEmbed)(
            batchSize, batchOffset, collection, embeddingsRunCol, fieldName
        );

        chunkArray(toEmbed, modelMetadata.invocation.inference_batch_size)
            .forEach(getAndSaveNodeEmbeddingsForMiniBatch(collection, dCollection));

        if (isLastBatch) {
            if (getEmbeddingsStatus(collectionName, destinationCollection, fieldName, modelMetadata) === EmbeddingsStatus.RUNNING_FAILED) {
                handleFailure(false, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
            } else {
                updateEmbeddingsStatus(EmbeddingsStatus.COMPLETED, collectionName, destinationCollection, fieldName, modelMetadata);
            }
        }
    } catch (e) {
        logErr(`Batch ${batchIndex} failed.`);
        logErr(e);
        handleFailure(true, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
    }

    // No matter what, queue the next batch
    if (!isLastBatch) {
        const q = queues.get(EMB_QUEUE_NAME);
        queueBatch(ScriptName.NODE,
            batchIndex + 1,
            batchSize,
            numberOfBatches,
            (batchOffset + batchSize),
            null,
            collectionName,
            fieldName,
            modelMetadata,
            q,
            destinationCollection,
            separateCollection,
            embeddingsRunColName
        );
    } else {
        // If it's the last batch, then we can drop the embeddingsRun collection
        db._collection(embeddingsRunColName).drop();
    }
}

if (!embeddingsTargetsAreValid(null, collectionName)) {
    logMsg(`Embeddings target collection ${collectionName} is no longer valid. Aborting generation...`);
} else {
    profileCall(createNodeEmbeddings)();
}
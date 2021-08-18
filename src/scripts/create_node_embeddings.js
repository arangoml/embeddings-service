"use strict";
const {query, db} = require("@arangodb");
const request = require("@arangodb/request");
const {profileCall} = require("../utils/profiling");
const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
const {logErr} = require("../utils/logging");
const {logMsg} = require("../utils/logging");
const {getEmbeddingsFieldName, deleteEmbeddingsFieldEntries} = require("../services/emb_collections_service");
const {getEmbeddingsStatus, updateEmbeddingsStatus} = require("../services/emb_status_service");
const {queueBatch, ScriptName} = require("../services/emb_generation_service");
const {EmbeddingsStatus} = require("../model/embeddings_status");
const {EMB_QUEUE_NAME} = require("../utils/embeddings_queue");
const {embeddingsTargetsAreValid} = require("../utils/embeddings_target");

const {argv} = module.context;

const {batchIndex, batchSize, numberOfBatches, batchOffset, collectionName, modelMetadata, fieldName, destinationCollection, separateCollection, embeddingsRunColName} = argv[0];
const isLastBatch = (batchIndex >= (numberOfBatches - 1));

const MAX_RETRIES = 5;

function getDocumentsToEmbed(nDocs, startInd, docCollection, embeddingsRunCol, fieldToEmbed) {
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

function formatBatch(batchData) {
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

function invokeEmbeddingModel(dataToEmbed) {
    const embeddingsServiceUrl = `${context.configuration.embeddingService}/v2/models/${modelMetadata.invocation_name}/infer`;
    let tries = 0;
    let res = {"status": -1};

    while (res.status !== 200 && tries < MAX_RETRIES) {
        const now = new Date().getTime();
        while (new Date().getTime() < now + tries) {
            // NOP
        }

        res = request.post(embeddingsServiceUrl, {
            body: formatBatch(dataToEmbed),
            json: true
        });
        tries++;
    }
    return res;
}

function chunkArray(array, chunk_size) {
    return Array(Math.ceil(array.length / chunk_size))
        .fill()
        .map((_, i) => i * chunk_size)
        .map(begin => array.slice(begin, begin + chunk_size));
}

function extractEmbeddingsFromResponse(response_json, embedding_dim) {
    // N.B. this is brittle, do output formats differ per model?
    const output = JSON.parse(response_json);
    const giant_arr = output["outputs"][0]["data"];
    return chunkArray(giant_arr, embedding_dim);
}

function logTimeElapsed(response_json) {
    if (context.configuration.enableProfiling === false) {
        return;
    }
    const output = JSON.parse(response_json);
    output["outputs"]
        .filter(e => e["name"].startsWith("TIME"))
        .forEach(e => {
            logMsg(`Model call ${e["name"]} on compute node took ${e["data"]} ms`);
        });
}

function insertEmbeddingsIntoDBSameCollection(docsWithKey, calculatedEmbeddings, fieldName, collection, modelMetadata) {
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

function insertEmbeddingsIntoDBSepCollection(docsWithKey, calculatedEmbeddings, fieldName, dCollection, modelMetadata) {
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


function rollbackGeneratedEmbeddings(destinationCollectionName, fieldName, modelMetadata) {
    logMsg("Rolling back existing embeddings");
    deleteEmbeddingsFieldEntries(destinationCollectionName, fieldName, modelMetadata);
}

function handleFailure(currentBatchFailed, isTheLastBatch, collectionName, destinationCollectionName, fieldName, modelMetadata) {
    if (currentBatchFailed) {
        updateEmbeddingsStatus(EmbeddingsStatus.RUNNING_FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
        // Disabled to enable partial loads
        // rollbackGeneratedEmbeddings(destinationCollectionName, fieldName, modelMetadata);
    }

    if (isTheLastBatch) {
        updateEmbeddingsStatus(EmbeddingsStatus.FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
    }
}

function getAndSaveNodeEmbeddingsForMiniBatch(collection, dCollection) {
    return function (miniBatch) {
        const requestData = miniBatch.map(x => x["field"]);
        const res = profileCall(invokeEmbeddingModel)(requestData);

        if (res.status === 200) {
            logTimeElapsed(res.body);
            const embeddings = profileCall(extractEmbeddingsFromResponse)(res.body, modelMetadata.metadata.emb_dim);
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

function createNodeEmbeddings() {
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

        chunkArray(toEmbed, modelMetadata.metadata.inference_batch_size)
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
"use strict";
const {query, db} = require("@arangodb");
const request = require("@arangodb/request");
const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
const {getEmbeddingsFieldName, deleteEmbeddingsFieldEntries} = require("../services/emb_collections_service");
const {getEmbeddingsStatus, updateEmbeddingsStatus} = require("../services/emb_status_service");
const {queueBatch, scripts} = require("../services/emb_generation_service");
const {embeddingsStatus} = require("../model/embeddings_status");
const {EMB_QUEUE_NAME} = require("../utils/embeddings_queue");

const {argv} = module.context;

const {batchIndex, batchSize, numberOfBatches, batchOffset, collectionName, modelMetadata, fieldName, destinationCollection, separateCollection } = argv[0];
const isLastBatch = (batchIndex === (numberOfBatches - 1));

const MAX_RETRIES = 5;

function getDocumentsToEmbed(nDocs, startInd, docCollection, destinationCollection, isSeparateCollection, fieldToEmbed, embeddingFieldName) {
    if (isSeparateCollection) {
        return query`
        FOR doc in ${docCollection}
            FILTER doc[${fieldToEmbed}] != null
            LET emb_docs = (
                FOR emb_d in ${dCol}
                  FILTER emb_d.doc_key == doc._key
                  FILTER emb_d.${embeddingFieldName} != null
                  RETURN 1
            )  
            FILTER LENGTH(emb_docs) == 0
            LIMIT ${startInd}, ${nDocs}
            RETURN {
              "_key": doc._key,
              "field": doc.${fieldToEmbed}
            }
        `.toArray();
    } else {
        return query`
        FOR doc in ${collection}
            FILTER doc.${fieldToEmbed} != null
            FILTER doc.${embeddingFieldName} == null
            LIMIT ${startInd}, ${nDocs}
            RETURN {
              "_key": doc._key,
              "field": doc.${fieldToEmbed}
            }
        `.toArray();
    }
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

function insertEmbeddingsIntoDBSameCollection(docsWithKey, calculatedEmbeddings, fieldName, collection, modelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return { "_key": x["_key"], "embedding": calculatedEmbeddings[i] };
    });

    const embedding_field_name = getEmbeddingsFieldName(fieldName, modelMetadata);

    query`
    FOR doc in ${docs}
      UPDATE {
        _key: doc["_key"]
      } WITH {
        ${embedding_field_name}: doc["embedding"]
      } IN ${collection}
    `
}

function insertEmbeddingsIntoDBSepCollection(docsWithKey, calculatedEmbeddings, fieldName, dCollection, modelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return { "_key": x["_key"], "embedding": calculatedEmbeddings[i], "emb_key": `emb_${x["_key"]}`};
    });

    const embedding_field_name = getEmbeddingsFieldName(fieldName, modelMetadata);

    query`
    FOR doc in ${docs}
      UPSERT {
        _key: doc["emb_key"],
      }
      INSERT {
        _key: doc["emb_key"],
        doc_key: doc["_key"],
        ${embedding_field_name}: doc["embedding"]
      }
      UPDATE {
        ${embedding_field_name}: doc["embedding"]
      } IN ${dCollection}
    `;
}


function rollbackGeneratedEmbeddings(destinationCollectionName, fieldName, modelMetadata) {
    console.log("Rolling back existing embeddings");
    deleteEmbeddingsFieldEntries(destinationCollectionName, fieldName, modelMetadata);
}

function handleFailure(currentBatchFailed, isTheLastBatch, collectionName, destinationCollectionName, fieldName, modelMetadata) {
    if (currentBatchFailed) {
        updateEmbeddingsStatus(embeddingsStatus.RUNNING_FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
        // Disabled to enable partial loads
        // rollbackGeneratedEmbeddings(destinationCollectionName, fieldName, modelMetadata);
    }

    if (isTheLastBatch) {
        updateEmbeddingsStatus(embeddingsStatus.FAILED, collectionName, destinationCollectionName, fieldName, modelMetadata);
    }
}

let newBatchOffset = batchOffset;
try {
    // Actual processing done here
    console.log(`Create embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} using ${modelMetadata.name} on the ${fieldName} field`);
    const collection = db._collection(collectionName)
    let dCollection;
    if (separateCollection) {
        dCollection = db._collection(destinationCollection);
    } else {
        dCollection = collection;
    }

    const toEmbed = getDocumentsToEmbed(
        batchSize, batchOffset, collection, dCollection, separateCollection, fieldName, getEmbeddingsFieldName(fieldName, modelMetadata)
    );
    const requestData = toEmbed.map(x => x["field"]);
    const res = invokeEmbeddingModel(requestData);

    if (res.status === 200) {
        const embeddings = extractEmbeddingsFromResponse(res.body, modelMetadata.metadata.emb_dim);
        if (separateCollection) {
            insertEmbeddingsIntoDBSepCollection(toEmbed, embeddings, fieldName, dCollection, modelMetadata);
            newBatchOffset += batchSize;
        } else {
            insertEmbeddingsIntoDBSameCollection(toEmbed, embeddings, fieldName, collection, modelMetadata);
        }
        if (isLastBatch) {
            if (getEmbeddingsStatus(collectionName, destinationCollection, fieldName, modelMetadata) === embeddingsStatus.RUNNING_FAILED) {
                handleFailure(false, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
            } else {
                updateEmbeddingsStatus(embeddingsStatus.COMPLETED, collectionName, destinationCollection, fieldName, modelMetadata);
            }
        }
    } else {
        console.error("Failed to get requested embeddings!!");
        handleFailure(true, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
    }
} catch (e) {
    console.error(`Batch ${batchIndex} failed.`);
    handleFailure(true, isLastBatch, collectionName, destinationCollection, fieldName, modelMetadata);
}

// No matter what, queue the next batch
if (!isLastBatch) {
    const q = queues.get(EMB_QUEUE_NAME);
    queueBatch(scripts.NODE,
        batchIndex + 1,
        batchSize,
        numberOfBatches,
        newBatchOffset,
        null,
        collectionName,
        fieldName,
        modelMetadata,
        q,
        destinationCollection,
        separateCollection
    );
}
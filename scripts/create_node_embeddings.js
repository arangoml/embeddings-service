"use strict";
const {query, db} = require("@arangodb");
const request = require("@arangodb/request");
const {getEmbeddingsFieldName} = require("../services/emb_collections_service");
const {getEmbeddingsStatus, updateEmbeddingsStatus} = require("../services/emb_status_service");
const {embeddingsStatus} = require("../model/embeddings_status");
const {context} = require("@arangodb/locals");

const {argv} = module.context;

const {batchIndex, batchSize, collectionName, modelMetadata, fieldName, destinationCollection, separateCollection, isLastBatch } = argv[0];
const MAX_RETRIES = 5;

function getDocumentsToEmbed(nDocs, startInd, collection, fieldToEmbed) {
    const start_index = startInd * nDocs;

    const toEmbed = query`
    FOR doc in ${collection}
        FILTER doc.${fieldToEmbed} != null
        LIMIT ${start_index}, ${nDocs}
        RETURN {
          "_key": doc._key,
          "field": doc.${fieldToEmbed}
        }
    `.toArray();
    return toEmbed;
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
    }
}

function invokeEmbeddingModel(dataToEmbed) {
    const embeddingsServiceUrl = `${context.configuration.embeddingService}/v2/models/${modelMetadata.invocation_name}/infer`;
    let tries = 0;
    let res = {"status": -1};

    while (res.status != 200 && tries < MAX_RETRIES) {
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

// Actual processing done here
console.log(`Create embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} using ${modelMetadata.name} on the ${fieldName} field`);
const collection = db._collection(collectionName)
const toEmbed = getDocumentsToEmbed(batchSize, batchIndex, collection, fieldName);
const requestData = toEmbed.map(x => x["field"]);
const res = invokeEmbeddingModel(requestData);

if (res.status == 200) {
    const embeddings = extractEmbeddingsFromResponse(res.body, modelMetadata.metadata.emb_dim);
    if (separateCollection) {
        const dCollection = db._collection(destinationCollection);
        insertEmbeddingsIntoDBSepCollection(toEmbed, embeddings, fieldName, dCollection, modelMetadata);
    } else {
        insertEmbeddingsIntoDBSameCollection(toEmbed, embeddings, fieldName, collection, modelMetadata);
    }
    if (isLastBatch) {
        updateEmbeddingsStatus(embeddingsStatus.COMPLETED, collectionName, destinationCollection, fieldName, modelMetadata);
    }
} else {
    console.error("Failed to get requested embeddings!!");
}

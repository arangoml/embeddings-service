"use strict";
const {query, db} = require("@arangodb");
const request = require("@arangodb/request");
const {context} = require("@arangodb/locals");

const {argv} = module.context;

const {batchIndex, batchSize, collectionName, modelMetadata, fieldName} = argv[0];

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
    const res = request.post(embeddingsServiceUrl, {
        body: formatBatch(dataToEmbed),
        json: true
    });
    return res;
}

function chunkArray(array, chunk_size) {
    return Array(Math.ceil(array.length / chunk_size))
        .fill()
        .map((_, i) => i * chunk_size)
        .map(begin => array.slice(begin, begin + chunk_size));
}

function extractEmbeddingsFromResponse(response_json, embedding_dim) {
    // TODO: this is brittle, outputs may differ per model
    const output = JSON.parse(response_json);
    const giant_arr = output["outputs"][0]["data"];
    return chunkArray(giant_arr, embedding_dim);
}

function insertEmbeddingsIntoDBSameCollection(docsWithKey, calculatedEmbeddings, collection, modelMetadata) {
    const docs = docsWithKey.map((x, i) => {
        return { "_key": x["_key"], "embedding": calculatedEmbeddings[i] };
    });

    const embedding_field_name = `emb_${modelMetadata.name}`

    query`
    FOR doc in ${docs}
      UPDATE {
        _key: doc["_key"]
      } WITH {
        ${embedding_field_name}: doc["embedding"]
      } IN ${collection}
    `
}


// Actual processing done here
console.log(`Create embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} using ${modelMetadata.name} on the ${fieldName} field`);
const collection = db._collection(collectionName)
const toEmbed = getDocumentsToEmbed(batchSize, batchIndex, collection, fieldName);
const requestData = toEmbed.map(x => x["field"]);
const res = invokeEmbeddingModel(requestData);
const embeddings = extractEmbeddingsFromResponse(res.body, modelMetadata.metadata.emb_dim);
insertEmbeddingsIntoDBSameCollection(toEmbed, embeddings, collection, modelMetadata);
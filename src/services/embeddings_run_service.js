// Manage the Embeddings Run Collection, which contains IDs of the documents that need to be embedded
"use strict";

const {db, query} = require("@arangodb");

function embeddingsRunCollectionName(embeddingsStatusDict) {
    return `docs_${embeddingsStatusDict["destination_collection"]}`;
}

function clearEmbeddingsRunCollection(embeddingsStatusDict) {
    let colName = embeddingsRunCollectionName(embeddingsStatusDict);
    let embeddingsRunCol = db._collection(colName);
    if (embeddingsRunCol) {
        embeddingsRunCol.drop();
    }
}

function createEmbeddingsRunCollection(embeddingsStatusDict) {
    let colName = embeddingsRunCollectionName(embeddingsStatusDict);
    let embeddingsRunCol = db._collection(colName);
    if (!embeddingsRunCol) {
        embeddingsRunCol = db._createDocumentCollection(colName);
    }
    return embeddingsRunCol;
}

function createAndAddEmbeddingsRunCollectionSameCollection(embeddingsStatusDict) {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsStatusDict);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsStatusDict);
    const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
    const embedding_field_name = embeddingsStatusDict["emb_field_name"];
    const sourceFieldName = embeddingsStatusDict["field_name"];
    query`
        FOR doc in ${dCol}
          FILTER doc.${sourceFieldName} != null
          FILTER doc.${embedding_field_name} == null
          INSERT { _key: doc._key } INTO ${embeddingsRunCol}
    `;
}

function createAndAddEmbeddingsRunCollectionSeparateCollection(embeddingsStatusDict) {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsStatusDict);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsStatusDict);
    const sourceCol = db._collection(embeddingsStatusDict["collection"]);
    const sourceFieldName = embeddingsStatusDict["field_name"];
    const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
    const embedding_field_name = embeddingsStatusDict["emb_field_name"];
    query`
        FOR doc in ${sourceCol}
          FILTER doc.${sourceFieldName} != null
          LET emb_docs = (
            FOR emb_d in ${dCol}
              FILTER emb_d.doc_key == doc._key
              FILTER emb_d.${embedding_field_name} != null
              LIMIT 1
              RETURN 1
          )
          FILTER LENGTH(emb_docs) == 0
          INSERT { _key: doc._key } INTO ${embeddingsRunCol}
    `;
    return embeddingsRunCol.name();
}

function createAndAddEmbeddingsRunCollectionAllValidDocs(embeddingsStatusDict) {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsStatusDict);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsStatusDict);
    const sourceCol = db._collection(embeddingsStatusDict["collection"]);
    const sourceFieldName = embeddingsStatusDict["field_name"];
    query`
        FOR doc in ${sourceCol}
          FILTER doc.${sourceFieldName} != null
          INSERT { _key: doc._key } INTO ${embeddingsRunCol}
    `;
    return embeddingsRunCol.name();
}

function createAndAddEmbeddingsRunCollection(embeddingsStatusDict, overwriteExisting) {
    if (overwriteExisting) {
        // here we just add all valid docs!
        return createAndAddEmbeddingsRunCollectionAllValidDocs(embeddingsStatusDict);
    }

    if (embeddingsStatusDict["destination_collection"] === embeddingsStatusDict["collection"]) {
        return createAndAddEmbeddingsRunCollectionSameCollection(embeddingsStatusDict);
    } else {
        return createAndAddEmbeddingsRunCollectionSeparateCollection(embeddingsStatusDict);
    }
}

function getCountEmbeddingsRunCollection(embeddingsStatusDict) {
    let colName = embeddingsRunCollectionName(embeddingsStatusDict);
    let embeddingsRunCol = db._collection(colName);
    if (!embeddingsRunCol) {
        return 0;
    }
    return query`
    RETURN COUNT(FOR d in ${embeddingsRunCol} RETURN 1)
    `.toArray()[0];
}

exports.createAndAddEmbeddingsRunCollection = createAndAddEmbeddingsRunCollection;
exports.clearEmbeddingsRunCollection = clearEmbeddingsRunCollection;
exports.getCountEmbeddingsRunCollection = getCountEmbeddingsRunCollection;
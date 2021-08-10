"use strict";

const {query, db} = require("@arangodb");

function colNameForCollectionAndModel(collectionName, modelName) {
    return `emb_${collectionName}_${modelName}`;
}

function getDestinationCollectionName(collectionName, separateCollection, modelMetadata) {
    // If not a separate collection, store on documents
    if (!separateCollection) {
        return collectionName;
    }
    // Otherwise create the separate collection name
    const colName = colNameForCollectionAndModel(collectionName, modelMetadata.name);

    // And create it if it doesn't already exist
    if (!db._collection(colName)) {
        const docCol = db._createDocumentCollection(colName);
        docCol.ensureIndex({"type": "persistent", "fields": ["doc_key"] });
    }

    // Then return it
    return colName;
}

function getEmbeddingsFieldName(fieldName, modelMetadata) {
    return `emb_${modelMetadata.name}_${fieldName}`;
}

function deleteEmbeddingsFieldEntries(destinationCollectionName, sourceFieldName, modelMetadata) {
    const dCol = db._collection(destinationCollectionName);
    const embedding_field_name = getEmbeddingsFieldName(sourceFieldName, modelMetadata);
    query`
    FOR doc in ${dCol}
      FILTER doc[${embedding_field_name}] != null
      UPDATE doc WITH { ${embedding_field_name}: null } IN ${dCol} OPTIONS { keepNull: false }
    `;
}

function getCountDocumentsSameCollection(embeddingsStatusDict, sourceFieldName) {
    const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
    const embedding_field_name = embeddingsStatusDict["emb_field_name"];
    return query`
        RETURN COUNT(FOR doc in ${dCol}
          FILTER doc.${sourceFieldName} != null
          FILTER doc.${embedding_field_name} == null
          RETURN 1)
    `.toArray()[0];
}

function getCountDocumentsSeparateCollection(embeddingsStatusDict, sourceFieldName) {
    const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
    const sCol = db._collection(embeddingsStatusDict["collection"]);

    const embedding_field_name = embeddingsStatusDict["emb_field_name"];

    return query`
        RETURN COUNT(
            FOR doc in ${sCol}
                FILTER doc.${sourceFieldName} != null
                LET emb_docs = (
                    FOR emb_d in ${dCol}
                        FILTER emb_d.doc_key == doc._key
                        FILTER emb_d.${embedding_field_name} != null
                        LIMIT 1
                        RETURN 1
                )  
                FILTER LENGTH(emb_docs) == 0
                RETURN 1
        )
        `.toArray()[0];
}

function getCountDocumentsWithoutEmbedding(embeddingsStatusDict, sourceFieldName) {
    if (embeddingsStatusDict["destination_collection"] === embeddingsStatusDict["collection"]) {
        return getCountDocumentsSameCollection(embeddingsStatusDict, sourceFieldName);
    } else {
        return getCountDocumentsSeparateCollection(embeddingsStatusDict, sourceFieldName);
    }
}

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

function createAndAddEmbeddingsRunCollectionSameCollection(embeddingsStatusDict, sourceFieldName) {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsStatusDict);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsStatusDict);
    const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
    const embedding_field_name = embeddingsStatusDict["emb_field_name"];
    query`
        FOR doc in ${dCol}
          FILTER doc.${sourceFieldName} != null
          FILTER doc.${embedding_field_name} == null
          INSERT { _key: doc._key } INTO ${embeddingsRunCol}
    `;
}

function createAndAddEmbeddingsRunCollectionSeparateCollection(embeddingsStatusDict, sourceFieldName) {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsStatusDict);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsStatusDict);
    const sourceCol = db._collection(embeddingsStatusDict["collection"]);
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

function createAndAddEmbeddingsRunCollectionAllValidDocs(embeddingsStatusDict, sourceFieldName) {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsStatusDict);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsStatusDict);
    const sourceCol = db._collection(embeddingsStatusDict["collection"]);
    query`
        FOR doc in ${sourceCol}
          FILTER doc.${sourceFieldName} != null
          INSERT { _key: doc._key } INTO ${embeddingsRunCol}
    `;
    return embeddingsRunCol.name();
}

function createAndAddEmbeddingsRunCollection(embeddingsStatusDict, sourceFieldName, overwriteExisting) {
    if (overwriteExisting) {
        // here we just add all valid docs!
        return createAndAddEmbeddingsRunCollectionAllValidDocs(embeddingsStatusDict, sourceFieldName);
    }

    if (embeddingsStatusDict["destination_collection"] === embeddingsStatusDict["collection"]) {
        return createAndAddEmbeddingsRunCollectionSameCollection(embeddingsStatusDict, sourceFieldName);
    } else {
        return createAndAddEmbeddingsRunCollectionSeparateCollection(embeddingsStatusDict, sourceFieldName);
    }
}

exports.getDestinationCollectionName = getDestinationCollectionName;
exports.getEmbeddingsFieldName = getEmbeddingsFieldName;
exports.deleteEmbeddingsFieldEntries = deleteEmbeddingsFieldEntries;
exports.getCountDocumentsWithoutEmbedding = getCountDocumentsWithoutEmbedding;
exports.createAndAddEmbeddingsRunCollection = createAndAddEmbeddingsRunCollection;
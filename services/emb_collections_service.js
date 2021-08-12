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

function pruneDocsWithChangedFieldsSameCollection(embeddingsStatusDict, fieldName) {
    const sCol = db._collection(embeddingsStatusDict["collection"]);
    const emb_field_name = embeddingsStatusDict["emb_field_name"];
    const emb_field_name_hash = `${emb_field_name}_hash`;
    query`
        FOR doc in ${sCol}
            FILTER doc.${emb_field_name_hash} != SHA1(doc.${fieldName})
            UPDATE doc WITH {
                ${emb_field_name}: null,
                ${emb_field_name_hash}: null
            } IN ${sCol} OPTIONS { keepNull: false }
    `;
}

function pruneDocsWithChangedFieldsSeparateCollection(embeddingsStatusDict, fieldName) {
    const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
    const sCol = db._collection(embeddingsStatusDict["collection"]);

    const emb_field_name = embeddingsStatusDict["emb_field_name"];
    const emb_field_name_hash = `${emb_field_name}_hash`;

    query`
        FOR emb_doc in ${dCol}
            LET corresponding = FIRST(
                FOR doc in ${sCol}
                    FILTER doc._key == emb_doc.doc_key
                    LIMIT 1
                    RETURN doc
            )
            FILTER emb_doc.${emb_field_name_hash} != SHA1(corresponding.${fieldName})
            UPDATE emb_doc WITH {
                ${emb_field_name}: null,
                ${emb_field_name_hash}: null
            } IN ${dCol} OPTIONS { keepNull: false }
    `;
}

function pruneDocsWithChangedFields(embeddingsStatusDict, fieldName) {
    if (embeddingsStatusDict["destination_collection"] === embeddingsStatusDict["collection"]) {
        pruneDocsWithChangedFieldsSameCollection(embeddingsStatusDict, fieldName);
    } else {
        pruneDocsWithChangedFieldsSeparateCollection(embeddingsStatusDict, fieldName);
    }
}

function pruneDeletedDocs(embeddingsStatusDict) {
    if (embeddingsStatusDict["destination_collection"] !== embeddingsStatusDict["collection"]) {
        const dCol = db._collection(embeddingsStatusDict["destination_collection"]);
        const sCol = db._collection(embeddingsStatusDict["collection"]);

        query`
            FOR emb_doc in ${dCol}
                LET corresponding = (
                    FOR doc in ${sCol}
                        FILTER doc._key == emb_doc.doc_key
                        LIMIT 1
                        RETURN 1
                )
                FILTER LENGTH(corresponding) == 0
                REMOVE emb_doc IN ${dCol}
        `;
    }
}

function pruneEmbeddings(embeddingsStatusDict, fieldName) {
    pruneDeletedDocs(embeddingsStatusDict);
    pruneDocsWithChangedFields(embeddingsStatusDict, fieldName);
}


exports.getDestinationCollectionName = getDestinationCollectionName;
exports.getEmbeddingsFieldName = getEmbeddingsFieldName;
exports.deleteEmbeddingsFieldEntries = deleteEmbeddingsFieldEntries;
exports.getCountDocumentsWithoutEmbedding = getCountDocumentsWithoutEmbedding;
exports.pruneEmbeddings = pruneEmbeddings;
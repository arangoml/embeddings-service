// Manage the Embeddings Run Collection, which contains IDs of the documents that need to be embedded
"use strict";

import Collection = ArangoDB.Collection;
import {db, query} from "@arangodb";
import {EmbeddingsState} from "../model/embeddings_status";

function embeddingsRunCollectionName(embeddingsState: EmbeddingsState): string {
    return `docs_${embeddingsState.destination_collection}`;
}

export function clearEmbeddingsRunCollection(embeddingsState: EmbeddingsState): void {
    let colName = embeddingsRunCollectionName(embeddingsState);
    let embeddingsRunCol = db._collection(colName);
    if (embeddingsRunCol) {
        embeddingsRunCol.drop();
    }
}

function createEmbeddingsRunCollection(embeddingsState: EmbeddingsState): Collection {
    let colName = embeddingsRunCollectionName(embeddingsState);
    let embeddingsRunCol = db._collection(colName);
    if (!embeddingsRunCol) {
        embeddingsRunCol = db._createDocumentCollection(colName);
    }
    return embeddingsRunCol;
}

function createAndAddEmbeddingsRunCollectionSameCollection(embeddingsState: EmbeddingsState): string {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsState);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsState);
    const dCol = db._collection(embeddingsState["destination_collection"]);
    const embedding_field_name = embeddingsState["emb_field_name"];
    const sourceFieldName = embeddingsState["field_name"];
    if (embeddingsState.specific_documents.length > 0) {
        query`
            LET specificDocuments = ${embeddingsState.specific_documents}
            FOR sDoc in specificDocuments
            FOR doc in ${dCol}
                FILTER doc._key == sDoc
                FILTER doc.${sourceFieldName} != null
                FILTER doc.${embedding_field_name} == null
                INSERT { _key: doc._key } INTO ${embeddingsRunCol}
        `;
    } else {
        query`
            FOR doc in ${dCol}
              FILTER doc.${sourceFieldName} != null
              FILTER doc.${embedding_field_name} == null
              INSERT { _key: doc._key } INTO ${embeddingsRunCol}
        `;
    }
    return embeddingsRunCol.name();
}

function createAndAddEmbeddingsRunCollectionSeparateCollection(embeddingsState: EmbeddingsState): string {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsState);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsState);
    const sourceCol = db._collection(embeddingsState.collection);
    const sourceFieldName = embeddingsState.field_name;
    const dCol = db._collection(embeddingsState.destination_collection);
    const embedding_field_name = embeddingsState.emb_field_name;
    if (embeddingsState.specific_documents.length > 0) {
        query`
            LET specificDocuments = ${embeddingsState.specific_documents}
            FOR sDoc in specificDocuments
            FOR doc in ${sourceCol}
              FILTER doc._key == sDoc
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
    } else {
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
    }
    return embeddingsRunCol.name();
}

function createAndAddEmbeddingsRunCollectionAllValidDocs(embeddingsState: EmbeddingsState): string {
    // Clear any docs first
    clearEmbeddingsRunCollection(embeddingsState);
    const embeddingsRunCol = createEmbeddingsRunCollection(embeddingsState);
    const sourceCol = db._collection(embeddingsState.collection);
    const sourceFieldName = embeddingsState.field_name;
    if (embeddingsState.specific_documents.length > 0) {
        query`
        LET specificDocuments = ${embeddingsState.specific_documents} 
        FOR sDoc in specificDocuments
            FOR doc in ${sourceCol}
              FILTER doc._key == sDoc
              FILTER doc.${sourceFieldName} != null
              INSERT { _key: doc._key } INTO ${embeddingsRunCol}
        `;
    } else {
        query`
            FOR doc in ${sourceCol}
              FILTER doc.${sourceFieldName} != null
              INSERT { _key: doc._key } INTO ${embeddingsRunCol}
        `;
    }
    return embeddingsRunCol.name();
}

export function createAndAddEmbeddingsRunCollection(embeddingsState: EmbeddingsState, overwriteExisting: boolean): string {
    if (overwriteExisting) {
        // here we just add all valid docs!
        return createAndAddEmbeddingsRunCollectionAllValidDocs(embeddingsState);
    }

    if (embeddingsState.destination_collection === embeddingsState.collection) {
        return createAndAddEmbeddingsRunCollectionSameCollection(embeddingsState);
    } else {
        return createAndAddEmbeddingsRunCollectionSeparateCollection(embeddingsState);
    }
}

export function getCountEmbeddingsRunCollection(embeddingsState: EmbeddingsState): number {
    let colName = embeddingsRunCollectionName(embeddingsState);
    let embeddingsRunCol = db._collection(colName);
    if (!embeddingsRunCol) {
        return 0;
    }
    return query`
    RETURN COUNT(FOR d in ${embeddingsRunCol} RETURN 1)
    `.toArray()[0];
}
"use strict";

import {query, db} from "@arangodb";
import {ModelMetadata} from "../model/model_metadata";
import {EmbeddingsState} from "../model/embeddings_status";

function colNameForCollectionAndModel(collectionName: string, modelName: string): string {
    return `emb_${collectionName}_${modelName}`;
}

export function getDestinationCollectionName(collectionName: string, separateCollection: boolean, modelMetadata: ModelMetadata): string {
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

export function getEmbeddingsFieldName(fieldName: string, modelMetadata: ModelMetadata): string {
    return `emb_${modelMetadata.name}_${fieldName}`;
}

export function deleteEmbeddingsFieldEntries(destinationCollectionName: string, sourceFieldName: string, modelMetadata: ModelMetadata): void {
    const dCol = db._collection(destinationCollectionName);
    const embedding_field_name = getEmbeddingsFieldName(sourceFieldName, modelMetadata);
    query`
    FOR doc in ${dCol}
      FILTER doc[${embedding_field_name}] != null
      UPDATE doc WITH { ${embedding_field_name}: null } IN ${dCol} OPTIONS { keepNull: false }
    `;
}

function getCountDocumentsSameCollection(embeddingsState: EmbeddingsState, sourceFieldName: string): number {
    const dCol = db._collection(embeddingsState.destination_collection);
    const embedding_field_name = embeddingsState.emb_field_name;
    return query`
        RETURN COUNT(FOR doc in ${dCol}
          FILTER doc.${sourceFieldName} != null
          FILTER doc.${embedding_field_name} == null
          RETURN 1)
    `.toArray()[0];
}

function getCountDocumentsSeparateCollection(embeddingsState: EmbeddingsState, sourceFieldName: string): number {
    const dCol = db._collection(embeddingsState.destination_collection);
    const sCol = db._collection(embeddingsState.collection);

    const embedding_field_name = embeddingsState.emb_field_name;

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

export function getCountDocumentsWithoutEmbedding(embeddingsState: EmbeddingsState, sourceFieldName: string): number {
    if (embeddingsState.destination_collection === embeddingsState.collection) {
        return getCountDocumentsSameCollection(embeddingsState, sourceFieldName);
    } else {
        return getCountDocumentsSeparateCollection(embeddingsState, sourceFieldName);
    }
}

function pruneDocsWithChangedFieldsSameCollection(embeddingsState: EmbeddingsState): void {
    const sCol = db._collection(embeddingsState.collection);
    const emb_field_name = embeddingsState.emb_field_name;
    const emb_field_name_hash = `${emb_field_name}_hash`;
    const field_name = embeddingsState.field_name;

    query`
        FOR doc in ${sCol}
            FILTER doc.${emb_field_name_hash} != SHA1(doc.${field_name})
            UPDATE doc WITH {
                ${emb_field_name}: null,
                ${emb_field_name_hash}: null
            } IN ${sCol} OPTIONS { keepNull: false }
    `;
}

function pruneDocsWithChangedFieldsSeparateCollection(embeddingsState: EmbeddingsState): void {
    const dCol = db._collection(embeddingsState.destination_collection);
    const sCol = db._collection(embeddingsState.collection);

    const emb_field_name = embeddingsState.emb_field_name;
    const emb_field_name_hash = `${emb_field_name}_hash`;
    const field_name = embeddingsState.field_name;

    query`
        FOR emb_doc in ${dCol}
            LET corresponding = FIRST(
                FOR doc in ${sCol}
                    FILTER doc._key == emb_doc.doc_key
                    LIMIT 1
                    RETURN doc
            )
            FILTER emb_doc.${emb_field_name_hash} != SHA1(corresponding.${field_name})
            UPDATE emb_doc WITH {
                ${emb_field_name}: null,
                ${emb_field_name_hash}: null
            } IN ${dCol} OPTIONS { keepNull: false }
    `;
}

function pruneDocsWithChangedFields(embeddingsState: EmbeddingsState): void {
    if (embeddingsState.destination_collection === embeddingsState.collection) {
        pruneDocsWithChangedFieldsSameCollection(embeddingsState);
    } else {
        pruneDocsWithChangedFieldsSeparateCollection(embeddingsState);
    }
}

function pruneDeletedDocs(embeddingsState: EmbeddingsState): void {
    if (embeddingsState.destination_collection !== embeddingsState.collection) {
        const dCol = db._collection(embeddingsState.destination_collection);
        const sCol = db._collection(embeddingsState.collection);

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

export function pruneEmbeddings(embeddingsState: EmbeddingsState): void {
    pruneDeletedDocs(embeddingsState);
    pruneDocsWithChangedFields(embeddingsState);
}
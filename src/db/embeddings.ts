import {aql, db, query} from "@arangodb";
import {embeddingsStatusCollectionName} from "../model/embeddings_status";

export function getEmbeddingsForDocumentKeys(
    documentCollectionName: string,
    embeddingsCollectionName: string,
    documentKeys: string[],
    fullDocuments: boolean,
    embeddingFieldName: string
) {
    const documentCollection = db._collection(documentCollectionName);
    if (documentCollectionName !== embeddingsStatusCollectionName) {
        const embeddingsCollection = db._collection(embeddingsCollectionName);
        return query`
            LET documentKeys = ${documentKeys}
            FOR docKey IN documentKeys
                FOR doc IN ${documentCollection}
                    FILTER doc._key == docKey
                    LET cor = FIRST(
                        FOR embDoc in ${embeddingsCollection}
                            FILTER embDoc.doc_key == doc._key
                            RETURN embDoc
                    )
                    RETURN ${aql.literal(fullDocuments)} ?
                        MERGE([
                            doc,
                            { embedding: cor[${embeddingFieldName}] }
                        ]) : {
                            document_key: doc._key,
                            embedding: cor[${embeddingFieldName}]
                        }
        `.toArray();
    }

    return query`
        LET documentKeys = ${documentKeys}
        FOR docKey IN documentKeys
            FOR doc IN ${documentCollection}
                FILTER doc._key == docKey
                RETURN ${aql.literal(fullDocuments)} ?
                    doc : {
                        document_key: doc._key,
                        embedding: doc[${embeddingFieldName}]
                    }
    `.toArray();
}
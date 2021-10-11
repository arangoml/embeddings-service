import {aql, db, query} from "@arangodb";
import {embeddingsStatusCollectionName} from "../model/embeddings_status";

export function getEmbeddingsForDocumentKeys(
    documentCollectionName: string,
    embeddingsCollectionName: string,
    documentKeys: string[],
    fullDocuments: boolean,
    embeddingFieldName: string,
    fields: string[]
) {
    const documentCollection = db._collection(documentCollectionName);
    const returnStatementArr = [];
    if (documentCollectionName !== embeddingsStatusCollectionName) {
        returnStatementArr.push(
            aql`
            LET cor = FIRST(
                        FOR embDoc in ${db._collection(embeddingsCollectionName)}
                            FILTER embDoc.doc_key == doc._key
                            RETURN embDoc
                    )
            `
        );
        if (fullDocuments) {
            returnStatementArr.push(aql`
                RETURN MERGE([
                    doc,
                    { embedding: cor[${embeddingFieldName}] }
                ])
            `);
        } else {
            returnStatementArr.push(aql`
                RETURN {
                    embedding: cor[${embeddingFieldName}],
                    ${aql.join([aql`document_key: doc._key`, ...fields.map(fname => aql`${fname}: doc.${fname}`)], ",")}
                }
            `)
        }
    } else {
        if (fullDocuments) {
            returnStatementArr.push(aql`RETURN doc`);
        } else {
            returnStatementArr.push(aql`
                RETURN {
                    embedding: doc[${embeddingFieldName}],
                    ${aql.join([aql`document_key: doc._key`, ...fields.map(fname => aql`${fname}: doc.${fname}`)], ",")}
                }
            `);
        }
    }

    return query`
        LET documentKeys = ${documentKeys}
        FOR docKey IN documentKeys
            FOR doc IN ${documentCollection}
                FILTER doc._key == docKey
                ${aql.join(returnStatementArr)}
    `.toArray();
}

export function findNearestNeighborEmbeddingsForDocumentKey(
    documentCollectionName: string,
    embeddingsCollectionName: string,
    documentKey: string,
    fullDocuments: boolean,
    embeddingFieldName: string,
    embeddingDimension: number,
    numberOfNeighbors: number
) {
    const documentCollection = db._collection(documentCollectionName);
    const lastEmbeddingInd = embeddingDimension - 1;
    if (documentCollectionName !== embeddingsStatusCollectionName) {
        const embeddingsCollection = db._collection(embeddingsCollectionName);
        return query`
            LET doc_emb = (
              FOR m in ${documentCollection}
                FILTER m.doc_key == ${documentKey}
                FOR j in RANGE(0, ${lastEmbeddingInd})
                  RETURN TO_NUMBER(NTH(m[${embeddingFieldName}],j))
            )
            
            LET doc_emb_magnitude = (
              SQRT(SUM(
                FOR i IN RANGE(0, ${lastEmbeddingInd})
                  RETURN POW(TO_NUMBER(NTH(doc_emb, i)), 2)
              ))
            )
            
            FOR v in ${embeddingsCollection}
                LET v_size = (SQRT(SUM(
                  FOR k IN RANGE(0, ${lastEmbeddingInd})
                    RETURN POW(TO_NUMBER(NTH(v[${embeddingFieldName}], k)), 2)
                )))

                LET numerator = (SUM(
                  FOR i in RANGE(0, ${lastEmbeddingInd})
                      RETURN TO_NUMBER(NTH(doc_emb, i)) * TO_NUMBER(NTH(v[${embeddingFieldName}], i))
                ))

                LET cos_sim = (numerator)/(doc_emb_magnitude * v_size)
                SORT cos_sim
                LIMIT ${numberOfNeighbors}
                
                RETURN ${aql.literal(fullDocuments)} ?
                    MERGE([
                        FIRST(
                            FOR v_doc IN ${documentCollection}
                                FILTER v_doc._key == v.doc_key
                                RETURN v_doc
                        ),
                        { embedding: v[${embeddingFieldName}] }
                    ]) : {
                        document_key: v.doc_key,
                        embedding: v[${embeddingFieldName}]
                    }
        `.toArray();
    }

    return query`
            LET doc_emb = (
              FOR m in ${documentCollection}
                FILTER m.doc_key == ${documentKey}
                FOR j in RANGE(0, ${lastEmbeddingInd})
                  RETURN TO_NUMBER(NTH(m[${embeddingFieldName}],j))
            )
            
            LET doc_emb_magnitude = (
              SQRT(SUM(
                FOR i IN RANGE(0, ${lastEmbeddingInd})
                  RETURN POW(TO_NUMBER(NTH(doc_emb, i)), 2)
              ))
            )
            
            FOR v in ${documentCollection}
                FILTER HAS(v, ${embeddingFieldName})
                LET v_size = (SQRT(SUM(
                  FOR k IN RANGE(0, ${lastEmbeddingInd})
                    RETURN POW(TO_NUMBER(NTH(v[${embeddingFieldName}], k)), 2)
                )))

                LET numerator = (SUM(
                  FOR i in RANGE(0, ${lastEmbeddingInd})
                      RETURN TO_NUMBER(NTH(doc_emb, i)) * TO_NUMBER(NTH(v[${embeddingFieldName}], i))
                ))

                LET cos_sim = (numerator)/(doc_emb_magnitude * v_size)
                SORT cos_sim
                LIMIT ${numberOfNeighbors}
                RETURN ${aql.literal(fullDocuments)} ?
                    v : {
                        document_key: v._key,
                        embedding: v[${embeddingFieldName}]
                    }
    `.toArray();
}
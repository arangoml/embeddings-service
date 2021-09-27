import {EmbeddingsState, EmbeddingsStatus} from "../model/embeddings_status";
import {getEmbeddingsForDocumentKeys} from "../db/embeddings";

interface EmbeddingObject {

};

export function getEmbeddingsForKeys(embStateDict: EmbeddingsState, documentKeys: string[], fullDocuments: boolean): { embeddings: EmbeddingObject[], possiblyStale: boolean }{
    //
    const couldBeStale = embStateDict.status !== EmbeddingsStatus.COMPLETED;
    return {
        embeddings: getEmbeddingsForDocumentKeys(embStateDict.collection, embStateDict.destination_collection, documentKeys, fullDocuments, embStateDict.emb_field_name),
        possiblyStale: couldBeStale
    };
}
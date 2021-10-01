import {EmbeddingsState, EmbeddingsStatus} from "../model/embeddings_status";
import {findNearestNeighborEmbeddingsForDocumentKey, getEmbeddingsForDocumentKeys} from "../db/embeddings";
import {ModelMetadata} from "../model/model_metadata";

interface EmbeddingObject {

};

interface NeighborsObject {};

export function getEmbeddingsForKeys(embStateDict: EmbeddingsState, documentKeys: string[], fullDocuments: boolean): { embeddings: EmbeddingObject[], possiblyStale: boolean }{
    //
    const couldBeStale = embStateDict.status !== EmbeddingsStatus.COMPLETED;
    return {
        embeddings: getEmbeddingsForDocumentKeys(embStateDict.collection, embStateDict.destination_collection, documentKeys, fullDocuments, embStateDict.emb_field_name),
        possiblyStale: couldBeStale
    };
}

export function getNearestNeighborsForKey(embStateDict: EmbeddingsState, modelMetadata: ModelMetadata, documentKey: string, fullDocuments: boolean, numberOfNeighbors: number): { embeddings: NeighborsObject, possiblyStale: boolean }{
    //
    const couldBeStale = embStateDict.status !== EmbeddingsStatus.COMPLETED;
    return {
        embeddings: findNearestNeighborEmbeddingsForDocumentKey(embStateDict.collection, embStateDict.destination_collection, documentKey, fullDocuments, embStateDict.emb_field_name, modelMetadata.invocation.emb_dim, numberOfNeighbors),
        possiblyStale: couldBeStale
    };
}
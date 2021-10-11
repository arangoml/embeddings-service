import {EmbeddingsState, EmbeddingsStatus} from "../model/embeddings_status";
import {findNearestNeighborEmbeddingsForDocumentKey, getEmbeddingsForDocumentKeys} from "../db/embeddings";
import {ModelMetadata} from "../model/model_metadata";

interface EmbeddingObject {
    embedding: number[]
};

interface NeighborsObject {};

export function getEmbeddingsForKeys(embStateDict: EmbeddingsState, documentKeys: string[], fullDocuments: boolean, fields: string[]): { embeddings: EmbeddingObject[], possiblyStale: boolean }{
    //
    const couldBeStale = embStateDict.status !== EmbeddingsStatus.COMPLETED;
    return {
        embeddings: getEmbeddingsForDocumentKeys(embStateDict.collection, embStateDict.destination_collection, documentKeys, fullDocuments, embStateDict.emb_field_name, fields),
        possiblyStale: couldBeStale
    };
}

export function getNearestNeighborsForKey(embStateDict: EmbeddingsState, modelMetadata: ModelMetadata, documentKey: string, fullDocuments: boolean, numberOfNeighbors: number, fields: string[]): { embeddings: NeighborsObject, possiblyStale: boolean }{
    //
    const couldBeStale = embStateDict.status !== EmbeddingsStatus.COMPLETED;
    return {
        embeddings: findNearestNeighborEmbeddingsForDocumentKey(embStateDict.collection, embStateDict.destination_collection, documentKey, fullDocuments, fields, embStateDict.emb_field_name, modelMetadata.invocation.emb_dim, numberOfNeighbors),
        possiblyStale: couldBeStale
    };
}
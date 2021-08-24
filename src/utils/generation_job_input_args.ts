import {ModelMetadata} from "../model/model_metadata";

export interface GenerationJobInputArgs {
    graphName: string;
    batchIndex: number;
    batchSize: number;
    numberOfBatches: number;
    batchOffset: number;
    collectionName: string;
    modelMetadata: ModelMetadata;
    fieldName: string;
    destinationCollection: string;
    separateCollection: boolean;
    embeddingsRunColName: string;
};

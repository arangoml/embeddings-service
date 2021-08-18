"use strict";
import {ModelMetadata} from "../model/model_metadata";

interface GenerationJobInputArgs {
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

const {argv} = module.context;

const {batchIndex, batchSize, collectionName, graphName, modelMetadata, fieldName}: GenerationJobInputArgs = argv[0];

console.log(`Create graph/traversal based embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} 
in graph ${graphName} using ${modelMetadata.name} on the ${fieldName} field`);

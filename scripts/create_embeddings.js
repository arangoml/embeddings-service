"use strict";

const {argv} = module.context;

const {batchInd, batchSize, collectionName, modelMetadata, fieldName} = argv[0];

console.log(`Create embeddings for batch ${batchInd} of size ${batchSize} in collection ${collectionName} using ${modelMetadata.name} on the ${fieldName} field`);
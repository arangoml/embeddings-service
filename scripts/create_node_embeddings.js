"use strict";

const {argv} = module.context;

const {batchIndex, batchSize, collectionName, modelMetadata, fieldName} = argv[0];

console.log(`Create embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} using ${modelMetadata.name} on the ${fieldName} field`);
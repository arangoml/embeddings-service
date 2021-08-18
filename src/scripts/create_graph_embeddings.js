"use strict";

const {argv} = module.context;

const {batchIndex, batchSize, collectionName, graphName, modelMetadata, fieldName} = argv[0];

console.log(`Create graph/traversal based embeddings for batch ${batchIndex} of size ${batchSize} in collection ${collectionName} 
in graph ${graphName} using ${modelMetadata.name} on the ${fieldName} field`);

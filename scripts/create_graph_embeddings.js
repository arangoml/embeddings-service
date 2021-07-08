"use strict";

const {argv} = module.context;

const {batchInd, batchSize, collectionName, graphName, modelMetadata, fieldName} = argv[0];

console.log(`Create graph/traversal based embeddings for batch ${batchInd} of size ${batchSize} in collection ${collectionName} 
in graph ${graphName} using ${modelMetadata.name} on the ${fieldName} field`);

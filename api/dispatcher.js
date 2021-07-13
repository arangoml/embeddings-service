const {context} = require("@arangodb/locals");
const queues = require("@arangodb/foxx/queues");
const {query, db} = require("@arangodb");

// TODO: Make this model specific?
const batch_size = 64;
const embeddingQueueName = "embeddings_generation";

function queueCollectionBatch(i, batchSize, colName, fieldName, modelMetadata, embeddingsQueue) {
    embeddingsQueue.push(
        {
            mount: context.mount,
            name: "createNodeEmbeddings"
        },
        {
            collectionName: colName,
            batchIndex: i,
            modelMetadata,
            fieldName,
            batchSize
        }
    );
}

function queueGraphBatch(i, batchSize, colName, graphName, fieldName, modelMetadata, embeddingsQueue) {
    embeddingsQueue.push(
        {
            mount: context.mount,
            name: "createGraphEmbeddings"
        },
        {
            collectionName: colName,
            batchIndex: i,
            graphName,
            modelMetadata,
            fieldName,
            batchSize
        }
    );
}

/**
 * Queue batch jobs to generate embeddings for a specified collection.
 */
function generateBatchesCollection(res, colName, fieldName, modelMetadata) {
    const myCol = db._collection(colName);
    const numberOfDocuments = query`
    RETURN COUNT(
        FOR doc in ${myCol}
        FILTER doc.${fieldName} != null
        RETURN 1
    )
    `.toArray();

    const numBatches = Math.ceil(numberOfDocuments / batch_size);

    const embQ = queues.create(embeddingQueueName);

    Array(numBatches)
        .fill()
        .map((_, i) => i)
        .forEach(i => queueCollectionBatch(i, batch_size, colName, fieldName, modelMetadata, embQ));

    res.sendStatus(200);
    res.json(`Queued generation of embeddings for collection ${colName} using ${modelMetadata.name} on the ${fieldName} field`);
}

/**
 * Queue batch jobs to generate embeddings for a specified graph.
 */
function generateBatchesGraph(res, graphName, collectionName, fieldName, modelMetadata) {
    const myCol = db._collection(collectionName);
    const numberOfDocuments = query`
    RETURN COUNT(
        FOR doc in ${myCol}
        FILTER doc.${fieldName} != null
        RETURN 1
    )
    `.toArray();

    const numBatches = Math.ceil(numberOfDocuments / batch_size);

    const embQ = queues.create(embeddingQueueName);

    Array(numBatches)
        .fill()
        .map((_, i) => i)
        .forEach(i => queueGraphBatch(i, batch_size, collectionName, graphName, fieldName, modelMetadata, embQ));

    res.sendStatus(200);
    res.json(`Queued generation of embeddings for collection ${collectionName} traversing ${graphName} using ${modelMetadata.name} on the ${fieldName} field`);
}

exports.BATCH_SIZE = batch_size;
exports.generateBatchesCollection = generateBatchesCollection;
exports.generateBatchesGraph = generateBatchesGraph;

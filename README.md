# Embeddings Service

This is a Foxx service that enables the generation of embeddings

## Installation/Development:
#### Compiling
The source for this Foxx service is written in Typescript. In order to run this on ArangoDB it will need to be 
compiled to Javascript using the typescript compiler. Please make sure that you have installed typescript (and the
other project dependencies) by running:

```npm install --production=false```

Once you have the compiler installed, you can run:

```npm run compile```

This will produce a `build/` directory with the required JS files. These are then ready to install on your ArangoDB
instance!

##### Installing 

The Foxx cli is an easy way to install the service. This 
cli can be installed as follows:

```npm install --global foxx-cli```

You can then install the Foxx service on your ArangoDB instance:

```foxx install /embeddings ./build```

The installed Foxx service can then be viewed in the ArangoDB UI.

This will install the service on the default `_system` database. If you'd like to install it on a different database - please
add the database parameter to the install command:

```foxx install --database my_db /embeddings ./build```

To see other options for the installation - such as user auth - please see `foxx install --help` for a full list of options.

To update your microservice with any changes you've made, please run:

```foxx upgrade /embeddings ./build```

Please note, once you have set up the service, you will also need to start an instance of the
[Embeddings Compute Service](https://github.com/arangoml/embeddings-compute).
By default, the Foxx service will assume that the Compute Service is running at `http://localhost:8000` - which is
relative to the Coordinator. This can be adjusted by changing the 
`embeddingService` entry in the `Settings` tab of the Embeddings Service in the 
ArangoDB UI.

###### Troubleshooting Installation 
If you are encountering issues with installation, you can also manually bundle the service:

```foxx bundle ./build ./embeddings_service.zip```

This will create a zip that you can use to install the service using the ArangoDB UI. 

## Quick Start

As a first step you will need to kickstart the generation of embeddings.

### Word Embeddings Generation

To generate word embeddings using a pre-trained MPNet Base transformer model,
you can supply the following to the `/generate_embeddings` endpoint:
```json
{
    "modelName": "paraphrase-mpnet-base-v2",
    "modelType": "word_embedding_model",
    "collectionName": "imdb_vertices",
    "fieldName": "description"
}
```
For word embeddings the service will require a collection name and a field name
to be supplied. In this case we're creating embeddings for the `description` field in the `IMDB` Graph dataset!

To monitor the progress of your embeddings generation, please see the "Check Status" heading below.

### GraphSAGE Embeddings Generation
N.B. This is currently limited to a model pre-trained on the Amazon Product Recommendation Dataset

To generate graph embeddings using a pre-trained GraphSAGE model,
you can supply the following to the `/generate_embeddings` endpoint:
```json
{
  "modelName": "graphsage_obgn_products",
  "modelType": "graph_embedding_model",
  "collectionName": "Products",
  "graphName": "amazon_product_graph",
  "fieldName": "product_feature"
}
```
This will create GraphSAGE embeddings, based off of 100-dimensional input feature vectors in
the Amazon Product Recommendation dataset.

### Check the status
To monitor the progress of your embeddings, you can poll the `/embeddings_status` route.
You can either:

a) supply the status ID that was supplied to you by the call to `/generate_embeddings`.
Then you can call `/embeddings_status/<my_id>`.

b) supply the parameters as query parameters to the API. For example:

`/embeddings_status?modelName=graphsage_obgn_products&modelType=graph_embedding_model&collectionName=Products&fieldName=product_feature`

Both will return the embeddings status JSON object, which will contain a field
called `status`. If the generation is still running you will see `running`, however,
if it is completed you will see `completed`. If something has gone wrong you may see `running_failed` or `failed`
as the status.

### Retrieval
Once you've generated your embeddings - you should be able to use them!

To retrieve embeddings for specific documents, you can use the 
`/embeddings` endpoint. To retrieve embeddings for a specific document, you can supply their
IDs as follows:
```json
{
  "modelName": "graphsage_obgn_products",
  "modelType": "graph_embedding_model",
  "collectionName": "Products",
  "fieldName": "product_feature",
  "documentKeys": ["1000002"]
}
```
If you would like to retrieve entire documents along with the embeddings, you can supply the argument `"fullDocuments": true`. If you don't
want whole documents but would like additional fields found on the documents - you can supply them using the `"fields": ["my-other-field-name"]` parameter.

Also, if the embeddings can be used for classification, you can supply a label mapping. The argmax of each document's 
embedding will then be mapped according to this array. e.g. if
`"label_mapping": ["first", "second", "third"]` is supplied for a 3-dimensional embedding, then for an embedding
`[0.01, 1.3, -1]`, `"label": "second"` will be returned as an additional field for that document.

### Nearest Neighbors

The service also supports a (POC - non-performant and subject to change) route for finding nearest neighbors based
on Cosine Similarity.
To retrieve nearest neighbors for a document, supply the `/nearest_neighbors` endpoint with a body such as:
```json
{
  "modelName": "graphsage_obgn_products",
  "modelType": "graph_embedding_model",
  "collectionName": "Products",
  "fieldName": "product_feature",
  "documentKey": "1000002",
  "fullDocuments": true,
  "numberOfNeighbors": 2
}
```
This will return the 2 nearest neighbors based on the cosine similarity of the computed embeddings.

### Configuration

Once you've installed the service - there are a few settings that you should be aware of. These can be adjusted
in the `Settings` pane of the service inside of the ArangoDB UI.
1) `embeddingService` - the URL for the Embeddings Compute Service. N.B. in cluster mode this should always
be adjusted
2) `enableProfiling` - this will log function call durations to the ArangoDB log. Useful when debugging & developing
3) `enableLogging` - this flag enables/disables logging by the Service.
4) `enableBackgroundManagement` - this flag enables/disables background management of the Embeddings.
Background management will take care of keeping the embeddings up to date and react to changes such as updates,
deletions, and insertions.
However, if you would only like to manually manage the creation of embeddings, please disable this.
5) `enableQueues` - this flag enables/disables the use of Foxx Queues. Without this enabled, the background generation
of embeddings, as well as the background management of embeddings, will not work.
6) `backgroundManagementInterval` - this specifies, in milliseconds, how often the background management should poll &
manage the embeddings. By default this is set to 2 hours, however, in many scenarios it may be prudent to increase this.
If you update the interval, it will take effect the next time the management runs. If this is not satisfactory, you
can manually trigger the `backgroundEmbeddingsManagement` script - which will manage the embeddings & set the new interval
immediately.
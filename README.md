# Embeddings Service

This is a Foxx service that enables the generation of embeddings

### Installation/Development:
The easiest way to get started is by first installing the Foxx
cli:

```npm install --global foxx-cli```

You can then install the Foxx service on your ArangoDB instance:

```foxx install /embeddings .```

The installed Foxx service can then be viewed in the ArangoDB UI.

To update your microservice with any changes you've made, please run:

```foxx upgrade /embeddings .```
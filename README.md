# Embeddings Service

This is a Foxx service that enables the generation of embeddings

### Installation/Development:
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

To update your microservice with any changes you've made, please run:

```foxx upgrade /embeddings ./build```
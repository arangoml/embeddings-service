"use strict";

const {context} = require("@arangodb/locals");
const createRouter = require("@arangodb/foxx/router");
const joi = require("joi");

const router = createRouter();
context.use(router);

router.post("/generate_embeddings", (req, res) => {
    // TODO:
    // First retrieve model metadata from document
    // Check if the arguments are valid, either for word embeddings or graph embeddings
    // Word embeddings case, require field on document that should be embedded
    // Check with a quick AQL query that this is actually valid

    // Then once the schema has been validated, pass the arguments on to the generate batches function
    generateBatches();
});

/**
 * Queue batch jobs to generate embeddings for a specified graph or collection.
 */
function generateBatches() {
    throw new Error("Implement me!");
}


router.get("/models", (_req, res) => {
    // TODO:
    // Query the model metadata collection and return the results here!
    throw new Error("Implement me!");
})
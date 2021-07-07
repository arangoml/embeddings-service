"use strict";

const {context} = require("@arangodb/locals");
const createRouter = require("@arangodb/foxx/router");
const {query} = require("@arangodb");
const joi = require("joi");

const router = createRouter();
context.use(router);

const METADATA_DOC_COLLECTION_NAME = "_model_metadata";

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
    // Query the model metadata collection and return the results here!
    const metadata_col = context.collection(METADATA_DOC_COLLECTION_NAME);
    const model_metadata = query`
        FOR m in ${metadata_col}
        RETURN {
            "name": m.name,
            "model_type": m.model_type,
            "emb_dim": m.emb_dim
        }
    `.toArray();
    res.json(model_metadata);
}).response(
    200,
    joi.array().items(
        joi.object({
            "name": joi.string(),
            "model_type": joi.string(),
            "emb_dim": joi.number()
        })
    )
);
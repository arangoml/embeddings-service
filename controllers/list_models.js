const {query, db} = require("@arangodb");
const {metadataCollectionName} = require("../model/model_metadata");

function listModels(_req, res) {
    // Query the model metadata collection and return the results here!
    const metadata_col = db._collection(metadataCollectionName);
    const model_metadata = query`
        FOR m in ${metadata_col}
        RETURN {
            "name": m.name,
            "model_type": m.model_type,
            "emb_dim": m.metadata.emb_dim
        }
    `.toArray();
    res.json(model_metadata);
}

exports.listModels = listModels;
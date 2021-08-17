/**
 * This module contains helper functions for checking if an embeddings target is still valid
 */
"use strict";
const {checkGraphIsPresent, checkCollectionIsPresent} = require("./db");

function embeddingsTargetsAreValid(graphName, collectionName) {
    if (graphName !== undefined && graphName !== null) {
        if (!checkGraphIsPresent(graphName)) {
            return false;
        }
    }
    // Collection is always present (as per schema)
    return checkCollectionIsPresent(collectionName);
}

exports.embeddingsTargetsAreValid = embeddingsTargetsAreValid;

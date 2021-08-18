/**
 * This module contains helper functions for checking if an embeddings target is still valid
 */
"use strict";
import {checkGraphIsPresent, checkCollectionIsPresent} from "./db";

function embeddingsTargetsAreValid(graphName: string | null, collectionName: string) {
    if (graphName !== null) {
        if (!checkGraphIsPresent(graphName)) {
            return false;
        }
    }
    // Collection is always present (as per schema)
    return checkCollectionIsPresent(collectionName);
}

exports.embeddingsTargetsAreValid = embeddingsTargetsAreValid;

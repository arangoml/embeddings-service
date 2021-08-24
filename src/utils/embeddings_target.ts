/**
 * This module contains helper functions for checking if an embeddings target is still valid
 */
"use strict";
import {checkGraphIsPresent, checkCollectionIsPresent} from "./db";

export function embeddingsTargetsAreValid(graphName: string | undefined | null, collectionName: string) {
    if (graphName !== null && graphName !== undefined) {
        if (!checkGraphIsPresent(graphName)) {
            return false;
        }
    }
    // Collection is always present (as per schema)
    return checkCollectionIsPresent(collectionName);
}

/**
 * This module contains database interaction utilities
 */
"use strict";
import Collection = ArangoDB.Collection;
import {db} from "@arangodb";
import * as graph_module from "@arangodb/general-graph";

export function checkGraphIsPresent(graphName: string) {
    return graph_module._list().some((g: string) => g === graphName)
}

export function checkCollectionIsPresent(collectionName: string) {
    return db._collections().map((c: Collection) => c.name()).some((n: string) => n === collectionName)
}
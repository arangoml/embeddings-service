/**
 * This module contains database interaction utilities
 */
"use strict";
const {db} = require("@arangodb");
const graph_module = require("@arangodb/general-graph");

function checkGraphIsPresent(graphName) {
    return graph_module._list().some(g => g === graphName)
}

function checkCollectionIsPresent(collectionName) {
    return db._collections().map(c => c.name()).some(n => n === collectionName)
}

exports.checkGraphIsPresent = checkGraphIsPresent;
exports.checkCollectionIsPresent = checkCollectionIsPresent;
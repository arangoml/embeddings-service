"use strict";

const {context} = require("@arangodb/locals");

function logMsg() {
    if (context.configuration.enableLogging) {
        console.log.apply(this, arguments);
    }
}

function logErr() {
    console.error.apply(this, arguments);
}

exports.logMsg = logMsg;
exports.logErr = logErr;

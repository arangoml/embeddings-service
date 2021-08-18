"use strict";

const {context} = require("@arangodb/locals");
const {router} = require("./api/router");

context.use(router);

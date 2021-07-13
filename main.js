"use strict";

const {context} = require("@arangodb/locals");
const {initRouter} = require("./api/router");

const router = initRouter();
context.use(router);

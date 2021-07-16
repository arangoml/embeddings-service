"use strict";

const {context} = require("@arangodb/locals");
const createRouter = require("@arangodb/foxx/router");
const joi = require("joi");

const router = createRouter();
context.use(router);
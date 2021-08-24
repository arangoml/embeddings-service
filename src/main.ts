"use strict";

import {context} from "@arangodb/locals";
import {router} from "./api/router";

context.use(router);

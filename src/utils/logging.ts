"use strict";

import {context} from "@arangodb/locals";

export function logMsg(...args: any[]) {
    if (context.configuration.enableLogging) {
        console.log(...args);
    }
}

export function logErr(...args: any[]) {
    console.error(...args);
}

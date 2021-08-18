"use strict";
// TODO: Check if this module can be supported, as new Date() can be pretty unreliable...
// const performance = {
//     now: function(start) {
//         if ( !start ) return process.hrtime();
//         var end = process.hrtime(start);
//         return Math.round((end[0]*1000) + (end[1]/1000000));
//     }
// }

import {logMsg} from "./logging";
import {context} from "@arangodb/locals";

export function profileCall(fn: Function) {
    return function(...args: any[]) {
        const start = Date.now();
        const result = fn(...args);
        const end = Date.now();
        if (context.configuration.enableProfiling) {
            logMsg(`Call to ${fn.name} took ${end - start} ms.`);
        }
        return result;
    };
}
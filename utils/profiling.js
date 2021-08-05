"use strict";
// TODO: Check if this module can be supported, as new Date() can be pretty unreliable...
// const performance = {
//     now: function(start) {
//         if ( !start ) return process.hrtime();
//         var end = process.hrtime(start);
//         return Math.round((end[0]*1000) + (end[1]/1000000));
//     }
// }

function profileCall(fn) {
    return function() {
        const start = new Date();
        const result = fn.apply(this, arguments);
        const end = new Date();
        console.log(`Call to ${fn.name} took ${end - start} ms.`);
        return result;
    };
}

exports.profileCall = profileCall;
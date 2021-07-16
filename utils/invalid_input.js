"use strict";

function sendInvalidInputMessage(res, message) {
    res.throw(422, message);
}

exports.sendInvalidInputMessage = sendInvalidInputMessage;

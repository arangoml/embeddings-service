"use strict";

import Response = Foxx.Response;

function sendInvalidInputMessage(res: Response, message: string) {
    res.throw(422, message);
}

exports.sendInvalidInputMessage = sendInvalidInputMessage;

"use strict";

import Response = Foxx.Response;

export function sendInvalidInputMessage(res: Response, message: string) {
    res.throw(422, message);
}
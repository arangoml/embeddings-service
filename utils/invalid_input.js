function sendInvalidInputMessage(res, message) {
    res.throw(422, message);
    return false;
}

exports.sendInvalidInputMessage = sendInvalidInputMessage;

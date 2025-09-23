exports.onSuccess = (message, result, res) => {
    res.status(200).json({
        message: message,
        Data: result,
        Status: 200,
        IsSuccess: true
    });
}

exports.onBadRequest = (message, res) => {
    res.status(400).json({
        message: message,
        Data: 0,
        Status: 400,
        IsSuccess: false
    });
}

exports.internalServer = (error, res) => {
    res.status(500).json({
        message: error.message,
        Data: 0,
        Status: 500,
        IsSuccess: false
    });
}

exports.unauthorisedRequest = (res) => {
    res.status(401).json({
        message: "Unauthorized Request!",
        Data: 0,
        Status: 401,
        IsSuccess: false
    });
}
exports.forbiddenRequest = (res) => {
    res.status(403).json({
        message: "Access to the requested resource is forbidden! Contact Administrator.",
        Data: 0,
        Status: 403,
        IsSuccess: false
    });
}
exports.notFoundRequest = (message, res) => {
    res.status(404).json({
        message: message,
        Data: 0,
        Status: 404,
        IsSuccess: false
    });
}
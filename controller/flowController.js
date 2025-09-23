const mongoConnection = require("../utilities/connetion");
const responseManager = require("../utilities/responseManager");
const flowModel = require("../models/flow.model");
const userModel = require("../models/user.model");
const constants = require("../utilities/constants");

exports.addUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        const body = req.body;
        console.log(":::::body", JSON.stringify(body));
        const userData = await primary.model(constants.MODELS.user, userModel).create(body);
        return responseManager.onSuccess("Data added successfully", userData, res);
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
}
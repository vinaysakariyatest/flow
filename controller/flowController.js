const mongoConnection = require("../utilities/connetion");
const responseManager = require("../utilities/responseManager");
const flowModel = require("../models/flow.model");
const userModel = require("../models/user.model");
const constants = require("../utilities/constants");
const categoryModel = require("../models/category.model");

exports.addUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        let { name, company_name, tags, category, consent, phone, link1, link2 } = req.body;
        console.log('=======req.body', JSON.stringify(req.body))
        const categoryIds = [];
        for (const catName of category) {
            let cat = await primary
                .model(constants.MODELS.category, categoryModel)
                .findOne({ name: catName });
            if (!cat) {
                cat = await primary
                    .model(constants.MODELS.category, categoryModel)
                    .create({ name: catName });
            }

            categoryIds.push(cat._id);
        }

        const obj = {
            name,
            company_name,
            tags,
            category: categoryIds,
            consent,
            phone,
            link1,
            link2,
        };
        const userData = await primary
            .model(constants.MODELS.user, userModel)
            .create(obj);

        return responseManager.onSuccess("Data added successfully", userData, res);
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
};

exports.searchUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        const { search } = req.body;

        if (!search || search.trim() === "") {
            return responseManager.onBadRequest("Search term required", res);
        }
        const companyData = await primary.model(constants.MODELS.user, userModel).find({
            company_name: { $regex: search, $options: "i" }
        }).select("name company_name consent phone link1 link2");
        if(companyData.length > 0){
            return responseManager.onSuccess("Search result", companyData, res);
        }else{
            return responseManager.onBadRequest("Data not found", res);
        }
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
};
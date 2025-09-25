const mongoConnection = require("../utilities/connetion");
const responseManager = require("../utilities/responseManager");
const flowModel = require("../models/flow.model");
const userModel = require("../models/user.model");
const constants = require("../utilities/constants");
const categoryModel = require("../models/category.model");
// const { GoogleGenAI } = require('@google/genai');
// const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.checkUserProfile = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        const { phone } = req.body;
        if (!phone) {
            return responseManager.onBadRequest("Phone number required", res);
        }
        const user = await primary
            .model(constants.MODELS.user, userModel)
            .findOne({ phone: phone })
            .select("name company_name bio interests consent phone link1 link2");

        if (user) {
            return responseManager.onSuccess("Profile exists", user, res);
        } else {
            return responseManager.notFoundRequest("Profile not found", res);
        }
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
};

// exports.addUser = async (req, res) => {
//     try {
//         const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//         let { name, company_name, category, consent, phone, link1, link2, bio } = req.body;

//         let bio_vector = null;
//         if (bio && bio.trim() !== "") {
//             const modelName = "text-embedding-004";
//             const embeddingResponse = await genAI.models.embedContent({
//                 model: modelName,
//                 content: bio, 
//             });
//             bio_vector = embeddingResponse.embedding.values;
//         }
//         console.log(":::::bio_vector", bio_vector)
//         const obj = {
//             name,
//             company_name,
//             category,
//             consent,
//             phone,
//             link1,
//             link2,
//             bio,
//             bio_vector
//         };

//         const userData = await primary
//             .model(constants.MODELS.user, userModel)
//             .create(obj);

//         return responseManager.onSuccess("Data added successfully", userData, res);
//     } catch (error) {
//         console.log(":::::error:::::", error);
//         return responseManager.internalServer(error, res);
//     }
// };

exports.addUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        let { name, company_name, category, consent, phone, link1, link2, bio } = req.body;
        console.log('=======req.body', JSON.stringify(req.body))
        const obj = {
            name,
            company_name,
            category,
            consent,
            phone,
            link1,
            link2,
            bio
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

exports.updateUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        let { mobile } = req.params;

        const existingUser = await primary
            .model(constants.MODELS.user, userModel)
            .findOne({ phone: mobile })
            .lean();

        if (!existingUser) {
            return responseManager.onBadRequest("User not found", res);
        }
        let { phone, name, company_name, category, consent, link1, link2, bio } = req.body;
        console.log("=======req.body", JSON.stringify(req.body));

        const updateData = {
            ...(phone && { phone }),
            ...(name && { name }),
            ...(company_name && { company_name }),
            ...(category && { category }),
            ...(consent && { consent }),
            ...(link1 && { link1 }),
            ...(link2 && { link2 }),
            ...(bio && { bio }),
        };
        const userData = await primary
            .model(constants.MODELS.user, userModel)
            .findOneAndUpdate(
                { phone: mobile },
                { $set: updateData },
                { new: true }
            );
        return responseManager.onSuccess("Data updated successfully", userData, res);
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
        if (companyData.length > 0) {
            return responseManager.onSuccess("Search result", companyData, res);
        } else {
            return responseManager.onBadRequest("Data not found", res);
        }
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
};

exports.searchUserByCategoryAndBio = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        const { categorySearch, bioSearch } = req.body;

        if ((!categorySearch || categorySearch.trim() === "") && (!bioSearch || bioSearch.trim() === "")) {
            return responseManager.onBadRequest("At least one search term required", res);
        }

        // Base query
        let query = {};
        if (categorySearch && categorySearch.trim() !== "") {
            query.category = { $elemMatch: { $regex: categorySearch, $options: "i" } };
        }
        if (bioSearch && bioSearch.trim() !== "") {
            query.bio = { $regex: bioSearch, $options: "i" };
        }

        // Find the record with lowest searchCount
        // Step 1: Try to find record not viewed yet
        let userData = await primary
            .model(constants.MODELS.user, userModel)
            .findOneAndUpdate(
                { ...query, viewedInCurrentSession: { $ne: true } },
                { $inc: { searchCount: 1 }, $set: { viewedInCurrentSession: true } },
                { sort: { searchCount: 1 }, new: true }
            )
            .lean();

        // Step 2: Agar sab viewed ho gaye ho, phir lowest searchCount wala fetch karo
        if (!userData) {
            userData = await primary
                .model(constants.MODELS.user, userModel)
                .findOneAndUpdate(
                    query,
                    { $inc: { searchCount: 1 }, $set: { viewedInCurrentSession: true } },
                    { sort: { searchCount: 1 }, new: true }
                )
                .lean();
        }

        if (userData) {
            return responseManager.onSuccess("Search result", userData, res);
        } else {
            return responseManager.onBadRequest("Data not found", res);
        }

    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
};

// exports.searchUserByCategory = async (req, res) => {
//     try {
//         const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//         const { search } = req.body;

//         if (!search || search.trim() === "") {
//             return responseManager.onBadRequest("Search term required", res);
//         }

//         const userData = await primary
//             .model(constants.MODELS.user, userModel)
//             .find({
//                 category: { $elemMatch: { $regex: search, $options: "i" } }
//             });

//         if (userData.length > 0) {
//             return responseManager.onSuccess("Search result", userData, res);
//         } else {
//             return responseManager.onBadRequest("Data not found", res);
//         }
//     } catch (error) {
//         console.log(":::::error:::::", error);
//         return responseManager.internalServer(error, res);
//     }
// };
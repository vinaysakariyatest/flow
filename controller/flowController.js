const mongoConnection = require("../utilities/connetion");
const responseManager = require("../utilities/responseManager");
const flowModel = require("../models/flow.model");
const userModel = require("../models/user.model");
const constants = require("../utilities/constants");
const categoryModel = require("../models/category.model");
const axios = require("axios");
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
//             const embeddingResponse = await axios.post(
//                 `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
//                 {
//                     model: "models/gemini-embedding-001",
//                     content: { parts: [{ text: bio }] }
//                 }
//             );
//             bio_vector = embeddingResponse.data.embedding.values;
//         }
//         const obj = {
//             name,
//             company_name,
//             category,
//             consent,
//             phone,
//             link1,
//             link2,
//             bio,
//             bio_vector,
//             searchCount: 0
//         };

//         const userData = await primary
//             .model(constants.MODELS.user, userModel)
//             .create(obj);

//         return responseManager.onSuccess("Data added successfully", userData, res);
//     } catch (error) {
//         console.log(":::::error:::::", error?.response?.data || error);
//         return responseManager.internalServer(error, res);
//     }
// };

exports.addUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        let { name, company_name, category, consent, phone, link1, link2, bio } = req.body;
        console.log('=======req.body', JSON.stringify(req.body))

        const categoryArray = category
            ? category.split(',').map(item => item.trim())
            : [];
        const obj = {
            name,
            company_name,
            category: categoryArray,
            consent,
            phone,
            link1,
            link2,
            bio
        };
        return
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

// function cosineSimilarity(vecA, vecB) {
//     if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
//     let dot = 0.0, normA = 0.0, normB = 0.0;
//     for (let i = 0; i < vecA.length; i++) {
//         dot += vecA[i] * vecB[i];
//         normA += vecA[i] * vecA[i];
//         normB += vecB[i] * vecB[i];
//     }
//     if (normA === 0 || normB === 0) return 0;
//     return dot / (Math.sqrt(normA) * Math.sqrt(normB));
// }

// exports.searchUserByCategoryAndBio = async (req, res) => {
//     try {
//         const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//         const { categorySearch, bioSearch } = req.body;

//         if ((!categorySearch || categorySearch.trim() === "") && (!bioSearch || bioSearch.trim() === "")) {
//             return responseManager.onBadRequest("At least one search term required", res);
//         }
//         let query = {};
//         if (categorySearch && categorySearch.trim() !== "") {
//             query.category = { $elemMatch: { $regex: categorySearch, $options: "i" } };
//         }

//         let allUsers = await primary
//             .model(constants.MODELS.user, userModel)
//             .find(query)
//             .lean();
//         if (allUsers.length === 0) {
//             return responseManager.onBadRequest("No users found for given category/bio", res);
//         }
//         let bestUser = null;

//         if (bioSearch && bioSearch.trim() !== "") {
//             const embeddingResponse = await axios.post(
//                 `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
//                 {
//                     model: "models/gemini-embedding-001",
//                     content: { parts: [{ text: bioSearch }] }
//                 }
//             );

//             const searchVector = embeddingResponse.data.embedding.values;

//             let maxSim = -1;
//             for (let user of allUsers) {
//                 if (user.bio_vector && user.bio_vector.length > 0) {
//                     const sim = cosineSimilarity(searchVector, user.bio_vector);
//                     if (sim > maxSim) {
//                         maxSim = sim;
//                         bestUser = user;
//                     }
//                 }
//             }
//             if (!bestUser) {
//                 return responseManager.onBadRequest("No matching bio found", res);
//             }

//         } else {
//             // -------------------------------
//             // 3. If no bio → pick lowest searchCount user
//             // -------------------------------
//             bestUser = allUsers.sort((a, b) => a.searchCount - b.searchCount)[0];
//         }

//         // -------------------------------
//         // 4. Update count
//         // -------------------------------
//         await primary
//             .model(constants.MODELS.user, userModel)
//             .findByIdAndUpdate(bestUser._id, { $inc: { searchCount: 1 } });

//         delete bestUser.bio_vector;
//         return responseManager.onSuccess("Search result", bestUser, res);

//     } catch (error) {
//         console.log(":::::error:::::", error?.response?.data || error);
//         return responseManager.internalServer(error, res);
//     }
// };

exports.searchUserByCategoryAndBio = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        const { categorySearch, bioSearch } = req.body;

        if ((!categorySearch || categorySearch.trim() === "") && (!bioSearch || bioSearch.trim() === "")) {
            return responseManager.onBadRequest("At least one search term required", res);
        }

        let query = {};
        if (categorySearch && categorySearch.trim() !== "") {
            query.category = { $elemMatch: { $regex: categorySearch, $options: "i" } };
        }
        if (bioSearch && bioSearch.trim() !== "") {
            query.bio = { $regex: bioSearch, $options: "i" };
        }
        let userData = await primary
            .model(constants.MODELS.user, userModel)
            .findOneAndUpdate(
                { ...query, viewedInCurrentSession: { $ne: true } },
                { $inc: { searchCount: 1 }, $set: { viewedInCurrentSession: true } },
                { sort: { searchCount: 1 }, new: true }
            )
            .lean();

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

exports.getCategoryByUser = async (req, res) => {
    try {
        const primary = mongoConnection.useDb(constants.DEFAULT_DB);
        const { phone } = req.body;
        const userData = await primary.model(constants.MODELS.user, userModel).findOne({ phone: phone }).select("category").lean();
        if (!userData) {
            return responseManager.onBadRequest("Data not found", res);
        }
        return responseManager.onSuccess("Data get successfully!", userData, res);
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
}

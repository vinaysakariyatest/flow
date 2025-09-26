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
        let { categorySearch, bioSearch, phone } = req.body;

        if ((!categorySearch || categorySearch.length === 0) && (!bioSearch || bioSearch.trim() === "")) {
            return responseManager.onBadRequest("At least one search term required", res);
        }

        let query = {};
        if (categorySearch && categorySearch.length > 0) {
            if (typeof categorySearch === "string") {
                categorySearch = categorySearch.split(',').map(c => c.trim());
            }
            query.category = { $in: categorySearch.map(c => new RegExp(c, "i")) };
        }

        if (bioSearch && bioSearch.trim() !== "") {
            query.bio = { $regex: bioSearch, $options: "i" };
        }
        if (phone && phone.trim() !== "") {
            query.phone = { $ne: phone.trim() };
        }

        let users = await primary
            .model(constants.MODELS.user, userModel)
            .find({ ...query, alreadyShown: { $ne: true } })
            .sort({ searchCount: 1 })
            .lean();

        if (users.length === 0) {
            await primary
                .model(constants.MODELS.user, userModel)
                .updateMany(query, { $set: { alreadyShown: false } });

            users = await primary
                .model(constants.MODELS.user, userModel)
                .find(query)
                .sort({ searchCount: 1 })
                .lean();
        }

        if (users.length === 0) {
            return responseManager.onBadRequest("Data not found", res);
        }

        const minCount = users[0].searchCount;
        const candidates = users.filter(u => u.searchCount === minCount);
        const randomUser = candidates[Math.floor(Math.random() * candidates.length)];

        await primary
            .model(constants.MODELS.user, userModel)
            .updateOne(
                { _id: randomUser._id },
                { $inc: { searchCount: 1 }, $set: { alreadyShown: true } }
            );
        return responseManager.onSuccess("Search result", randomUser, res);
    } catch (error) {
        console.log(":::::error:::::", error);
        return responseManager.internalServer(error, res);
    }
};


// With phone
// exports.searchUserByCategoryAndBio = async (req, res) => {
//     try {
//         const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//         let { categorySearch, bioSearch, phone } = req.body;

//         if ((!categorySearch || categorySearch.length === 0) && (!bioSearch || bioSearch.trim() === "")) {
//             return responseManager.onBadRequest("At least one search term required", res);
//         }
//         let query = {};
//         if (categorySearch && categorySearch.length > 0) {
//             if (typeof categorySearch === "string") {
//                 categorySearch = categorySearch.split(',').map(c => c.trim());
//             }
//             query.category = { $in: categorySearch.map(c => new RegExp(c, "i")) };
//         }
//         if (bioSearch && bioSearch.trim() !== "") {
//             query.bio = { $regex: bioSearch, $options: "i" };
//         }
//         if (phone && phone.trim() !== "") {
//             query.phone = { $ne: phone.trim() };
//         }
//         let users = await primary
//             .model(constants.MODELS.user, userModel)
//             .find({ ...query, viewedInCurrentSession: { $ne: true } })
//             .sort({ searchCount: 1 })
//             .lean();

//         if (users.length === 0) {
//             users = await primary
//                 .model(constants.MODELS.user, userModel)
//                 .find(query)
//                 .sort({ searchCount: 1 })
//                 .lean();
//         }

//         if (users.length === 0) {
//             return responseManager.onBadRequest("Data not found", res);
//         }
//         const minCount = users[0].searchCount;
//         const candidates = users.filter(u => u.searchCount === minCount);
//         const randomUser = candidates[Math.floor(Math.random() * candidates.length)];

//         await primary
//             .model(constants.MODELS.user, userModel)
//             .updateOne(
//                 { _id: randomUser._id },
//                 { $inc: { searchCount: 1 }, $set: { viewedInCurrentSession: true } }
//             );
//         return responseManager.onSuccess("Search result", randomUser, res);
//     } catch (error) {
//         console.log(":::::error:::::", error);
//         return responseManager.internalServer(error, res);
//     }
// };

//Without phone
// exports.searchUserByCategoryAndBio = async (req, res) => {
//     try {
//         const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//         const { categorySearch, bioSearch } = req.body;

//         if ((!categorySearch || categorySearch.length === 0) && (!bioSearch || bioSearch.trim() === "")) {
//             return responseManager.onBadRequest("At least one search term required", res);
//         }

//         let query = {};
//         if (categorySearch && categorySearch.length > 0) {
//             if (typeof categorySearch === "string") {
//                 categorySearch = categorySearch.split(',').map(c => c.trim());
//             }
//             query.category = { $in: categorySearch.map(c => new RegExp(c, "i")) };
//         }
//         if (bioSearch && bioSearch.trim() !== "") {
//             query.bio = { $regex: bioSearch, $options: "i" };
//         }
//         let userData = await primary
//             .model(constants.MODELS.user, userModel)
//             .findOneAndUpdate(
//                 { ...query, viewedInCurrentSession: { $ne: true } },
//                 { $inc: { searchCount: 1 }, $set: { viewedInCurrentSession: true } },
//                 { sort: { searchCount: 1 }, new: true }
//             )
//             .lean();

//         if (!userData) {
//             userData = await primary
//                 .model(constants.MODELS.user, userModel)
//                 .findOneAndUpdate(
//                     query,
//                     { $inc: { searchCount: 1 }, $set: { viewedInCurrentSession: true } },
//                     { sort: { searchCount: 1 }, new: true }
//                 )
//                 .lean();
//         }
//         if (userData) {
//             return responseManager.onSuccess("Search result", userData, res);
//         } else {
//             return responseManager.onBadRequest("Data not found", res);
//         }

//     } catch (error) {
//         console.log(":::::error:::::", error);
//         return responseManager.internalServer(error, res);
//     }
// };

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

const mongoConnection = require("../utilities/connetion");
const responseManager = require("../utilities/responseManager");
const flowModel = require("../models/flow.model");
const userModel = require("../models/user.model");
const constants = require("../utilities/constants");
const categoryModel = require("../models/category.model");
const axios = require("axios");
const { GoogleGenAI } = require('@google/genai')

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

async function main(textToEmbed) {
  const embedding = await getEmbedding(textToEmbed);
  return embedding
}

async function getEmbedding(text) {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Call embedContent
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });
    if (!response.embeddings || response.embeddings.length === 0) {
      console.error("No embeddings returned");
      return null;
    }

    // Return the vector values (first embedding)
    return response.embeddings[0].values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

exports.addUser = async (req, res) => {
  try {
     const primary = mongoConnection.useDb(constants.DEFAULT_DB);
    let { name, company_name, category, consent, phone, link1, link2, bio } = req.body;

    if (!Array.isArray(category)) {
      category = [category];
    }

    let bio_vector = null;
    bio_vector = await main(bio);

    const obj = {
      name,
      company_name,
      category,
      consent,
      phone,
      link1,
      link2,
      bio,
      bio_vector,
    };

    const userData = await primary
      .model(constants.MODELS.user, userModel)
      .create(obj);

    console.log("User created successfully:", userData._id);
    return responseManager.onSuccess("Data added successfully", userData, res);
  } catch (error) {
    console.error("Error adding user:", error?.response?.data || error);
    return responseManager.internalServer(error, res);
  }
};

// exports.addUser = async (req, res) => {
//     try {
//         const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//         let { name, company_name, category, consent, phone, link1, link2, bio } = req.body;
//         console.log('=======req.body', JSON.stringify(req.body))

//         const categoryArray = category
//             ? category.split(',').map(item => item.trim())
//             : [];
//         const obj = {
//             name,
//             company_name,
//             category: categoryArray,
//             consent,
//             phone,
//             link1,
//             link2,
//             bio
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

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

exports.getRecommendation = async (req, res) => {
  try {
    const primary = mongoConnection.useDb(constants.DEFAULT_DB);
    let { phone, categorySearch } = req.body;

    if (!phone || phone.trim() === "") {
      return responseManager.onBadRequest("Phone number is required", res);
    }
    if (!categorySearch || categorySearch.length === 0) {
      return responseManager.onBadRequest("Category is required", res);
    }

    if (typeof categorySearch === "string") {
      categorySearch = categorySearch.split(',').map(c => c.trim());
    }

    // Step 1: Current user
    const currentUser = await primary
      .model(constants.MODELS.user, userModel)
      .findOne({ phone: phone.trim(), bio_vector: { $exists: true, $ne: [] } })
      .lean();

    if (!currentUser || !currentUser.bio_vector) {
      return responseManager.onBadRequest("Current user has no bio_vector", res);
    }

    let otherUsers = await primary
      .model(constants.MODELS.user, userModel)
      .find({
        phone: { $ne: phone.trim() },
        category: { $in: categorySearch.map(c => new RegExp(c, "i")) },
        bio_vector: { $exists: true, $ne: [] },
        alreadyShown: { $ne: true }
      })
      .lean();

    if (otherUsers.length === 0) {
      await primary
        .model(constants.MODELS.user, userModel)
        .updateMany(
          {
            phone: { $ne: phone.trim() },
            category: { $in: categorySearch.map(c => new RegExp(c, "i")) }
          },
          { $set: { alreadyShown: false } }
        );

      otherUsers = await primary
        .model(constants.MODELS.user, userModel)
        .find({
          phone: { $ne: phone.trim() },
          category: { $in: categorySearch.map(c => new RegExp(c, "i")) },
          bio_vector: { $exists: true, $ne: [] },
          alreadyShown: { $ne: true }
        })
        .lean();
    }

    if (otherUsers.length === 0) {
      return responseManager.onBadRequest("No users found in this category with bio_vector", res);
    }

    const scoredUsers = otherUsers.map(user => {
      return {
        ...user,
        similarity: cosineSimilarity(currentUser.bio_vector, user.bio_vector)
      };
    });

    scoredUsers.sort((a, b) => b.similarity - a.similarity);
    const bestMatch = scoredUsers[0];

    if (!bestMatch) {
      return responseManager.onBadRequest("No suitable match found", res);
    }

    await primary
      .model(constants.MODELS.user, userModel)
      .updateOne(
        { _id: bestMatch._id },
        { $inc: { searchCount: 1 }, $set: { alreadyShown: true } }
      );

    return responseManager.onSuccess("Next match found", bestMatch, res);

  } catch (error) {
    console.error(":::::error in searchUserByCategoryAndBio :::::", error?.response?.data || error);
    return responseManager.internalServer(error, res);
  }
};

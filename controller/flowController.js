const mongoConnection = require("../utilities/connetion");
const responseManager = require("../utilities/responseManager");
const flowModel = require("../models/flow.model");
const userModel = require("../models/user.model");
const constants = require("../utilities/constants");
const categoryModel = require("../models/category.model");
const axios = require("axios");
const { GoogleGenAI } = require('@google/genai')
const mongoose = require("mongoose");

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

exports.addUservector = async (req, res) => {
  try {
    const primary = mongoConnection.useDb(constants.DEFAULT_DB);
    let { name, company_name, category, consent, phone, link1, link2, bio } = req.body;

    // Ensure category is an array
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
      recommendationsShown: [],
      searchCount: 0
    };

    const userData = await primary
      .model(constants.MODELS.user, userModel)
      .create(obj);

    // console.log("User created successfully:", userData._id);
    return responseManager.onSuccess("Data added successfully", userData, res);
  } catch (error) {
    console.error("Error adding user:", error?.response?.data || error);
    return responseManager.internalServer(error, res);
  }
};

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

// function cosineSimilarity(vecA, vecB) {
//   const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
//   const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
//   const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
//   return dot / (normA * normB);
// }

// exports.getRecommendation = async (req, res) => {
//   try {
//     const primary = mongoConnection.useDb(constants.DEFAULT_DB);
//     let { phone, categorySearch } = req.body;

//     if (!phone || phone.trim() === "") {
//       return responseManager.onBadRequest("Phone number is required", res);
//     }
//     if (!categorySearch || categorySearch.length === 0) {
//       return responseManager.onBadRequest("Category is required", res);
//     }

//     if (typeof categorySearch === "string") {
//       categorySearch = categorySearch.split(',').map(c => c.trim());
//     }

//     // Step 1: Current user
//     const currentUser = await primary
//       .model(constants.MODELS.user, userModel)
//       .findOne({ phone: phone.trim(), bio_vector: { $exists: true, $ne: [] } })
//       .lean();

//     if (!currentUser || !currentUser.bio_vector) {
//       return responseManager.onBadRequest("Current user has no bio_vector", res);
//     }

//     let otherUsers = await primary
//       .model(constants.MODELS.user, userModel)
//       .find({
//         phone: { $ne: phone.trim() },
//         category: { $in: categorySearch.map(c => new RegExp(c, "i")) },
//         bio_vector: { $exists: true, $ne: [] },
//         alreadyShown: { $ne: true }
//       })
//       .lean();

//     if (otherUsers.length === 0) {
//       await primary
//         .model(constants.MODELS.user, userModel)
//         .updateMany(
//           {
//             phone: { $ne: phone.trim() },
//             category: { $in: categorySearch.map(c => new RegExp(c, "i")) }
//           },
//           { $set: { alreadyShown: false } }
//         );

//       otherUsers = await primary
//         .model(constants.MODELS.user, userModel)
//         .find({
//           phone: { $ne: phone.trim() },
//           category: { $in: categorySearch.map(c => new RegExp(c, "i")) },
//           bio_vector: { $exists: true, $ne: [] },
//           alreadyShown: { $ne: true }
//         })
//         .lean();
//     }

//     if (otherUsers.length === 0) {
//       return responseManager.onBadRequest("No users found in this category with bio_vector", res);
//     }

//     const scoredUsers = otherUsers.map(user => {
//       return {
//         ...user,
//         similarity: cosineSimilarity(currentUser.bio_vector, user.bio_vector)
//       };
//     });

//     scoredUsers.sort((a, b) => b.similarity - a.similarity);
//     const bestMatch = scoredUsers[0];

//     if (!bestMatch) {
//       return responseManager.onBadRequest("No suitable match found", res);
//     }

//     await primary
//       .model(constants.MODELS.user, userModel)
//       .updateOne(
//         { _id: bestMatch._id },
//         { $inc: { searchCount: 1 }, $set: { alreadyShown: true } }
//       );

//     return responseManager.onSuccess("Next match found", bestMatch, res);

//   } catch (error) {
//     console.error(":::::error in searchUserByCategoryAndBio :::::", error?.response?.data || error);
//     return responseManager.internalServer(error, res);
//   }
// };


exports.getRecommendations = async (req, res) => {
  const { userId } = req.body;
  const primary = mongoConnection.useDb(constants.DEFAULT_DB);
  const User = primary.model(constants.MODELS.user, userModel);
  // Constants
  const SIM_THRESHOLD = 0.75;
  const TOP_N = 1;           // 👈 har call pe ek hi record
  const NUM_CANDIDATES = 200;

  try {
    const currentUser = await User.findById(userId).lean();
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const queryVecRaw = currentUser.bio_vector;
    if (!Array.isArray(queryVecRaw) || queryVecRaw.length === 0) {
      return res.status(400).json({ message: "Current user does not have a valid bio_vector" });
    }

    const queryVec = queryVecRaw.map(v => Number(v));

    const categoryArray = Array.isArray(currentUser.category)
      ? currentUser.category
      : (currentUser.category ? [currentUser.category] : []);

    const shownIds = (currentUser.recommendationsShown || []).map(id => {
      try { return mongoose.Types.ObjectId(id); } catch (e) { return id; }
    });

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Vector search pipeline
    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "bio_vector",
          queryVector: queryVec,
          numCandidates: NUM_CANDIDATES,
          limit: NUM_CANDIDATES,
          filter: {
            category: { $in: categoryArray }
          }
        }
      },
      { $addFields: { vsScore: { $meta: "vectorSearchScore" } } },
      {
        $match: {
          $and: [
            { _id: { $ne: userObjectId } },       // 👈 userId ko exclude
            { _id: { $nin: shownIds } }          // 👈 already shown ids
          ]
        }
      },
      { $project: { name: 1, link1: 1, link2: 1, phone: 1, bio: 1, bio_vector: 1, category: 1, vsScore: 1 } }
    ];

    const candidates = await User.aggregate(pipeline);

    // Cosine similarity helper
    const cosine = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -1;
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) {
        const va = Number(a[i]) || 0;
        const vb = Number(b[i]) || 0;
        dot += va * vb;
        na += va * va;
        nb += vb * vb;
      }
      if (na === 0 || nb === 0) return -1;
      return dot / (Math.sqrt(na) * Math.sqrt(nb));
    };

    const withSim = candidates.map(c => {
      const candVec = Array.isArray(c.bio_vector) ? c.bio_vector.map(Number) : [];
      const sim = (candVec.length === queryVec.length) ? cosine(queryVec, candVec) : -1;
      return { ...c, similarity: sim };
    });

    let filtered = withSim.filter(x => x.similarity >= SIM_THRESHOLD);
    filtered.sort((a, b) => b.similarity - a.similarity);

    const relaxThresholds = [0.70, 0.65, 0.60];
    if (filtered.length === 0) {
      for (const t of relaxThresholds) {
        filtered = withSim.filter(x => x.similarity >= t);
        if (filtered.length) break;
      }
    }

    let recommendations = filtered.slice(0, TOP_N);

    // Reset if all users shown
    if (recommendations.length === 0 && shownIds.length > 0) {
      await User.findByIdAndUpdate(currentUser._id, { $set: { recommendationsShown: [], searchCount: 0 } });

      const resetPipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "bio_vector",
            queryVector: queryVec,
            numCandidates: NUM_CANDIDATES,
            limit: NUM_CANDIDATES,
            filter: {
              category: { $in: categoryArray }
            }
          }
        },
        { $addFields: { vsScore: { $meta: "vectorSearchScore" } } },
        {
          $match: { _id: { $ne: userObjectId } }
        },
        { $project: { name: 1, link1: 1, link2: 1, phone: 1, bio: 1, bio_vector: 1, category: 1, vsScore: 1 } }
      ];

      const candidates2 = await User.aggregate(resetPipeline);
      const withSim2 = candidates2.map(c => {
        const candVec = Array.isArray(c.bio_vector) ? c.bio_vector.map(Number) : [];
        const sim = (candVec.length === queryVec.length) ? cosine(queryVec, candVec) : -1;
        return { ...c, similarity: sim };
      });

      withSim2.sort((a, b) => b.similarity - a.similarity);
      recommendations = withSim2.filter(x => x.similarity >= SIM_THRESHOLD).slice(0, TOP_N);

      if (recommendations.length === 0) {
        recommendations = withSim2.slice(0, TOP_N);
      }
    }

    if (recommendations.length === 0) {
      return res.json({ message: "No matching profiles found", recommendations: [] });
    }

    // Persist shown recommendations
    const newRecommendedIds = recommendations.map(r => r._id);
    await User.findByIdAndUpdate(currentUser._id, {
      $addToSet: { recommendationsShown: { $each: newRecommendedIds } },
      $inc: { searchCount: 1 }
    });

    return res.json({
      recommendations,
      totalShown: (currentUser.recommendationsShown || []).length + recommendations.length,
      searchCount: (currentUser.searchCount || 0) + 1
    });

  } catch (error) {
    console.error("Error getting recommendations:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

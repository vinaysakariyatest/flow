const mongoose = require("mongoose")
const mongoDB = mongoose.createConnection(process.env.MONGODB_URL);

module.exports = mongoDB;

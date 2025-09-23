const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const schema = new mongoose.Schema({}, {timestamps: true, strict: false });
schema.plugin(mongoosePaginate);
module.exports = schema;
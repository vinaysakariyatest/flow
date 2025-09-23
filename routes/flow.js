const express = require("express");
const router = express.Router();
const flowController = require("../controller/flowController");

router.post("/addUser", flowController.addUser)

module.exports = router
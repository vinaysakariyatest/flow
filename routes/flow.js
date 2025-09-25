const express = require("express");
const router = express.Router();
const flowController = require("../controller/flowController");

router.post("/checkUserProfile", flowController.checkUserProfile);
router.post("/addUser", flowController.addUser);
router.post("/searchCompany", flowController.searchUser);
router.post("/updateUser/:mobile", flowController.updateUser);

module.exports = router
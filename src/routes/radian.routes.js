const express = require("express");
const router = express.Router();
const radianController = require("../controllers/radian.controller");
const { validRadian } = require("../middleware/radianSend.middleware");

router.post("/send", validRadian, radianController.sendRadianData);

module.exports = router;
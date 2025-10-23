const express = require("express");
const router = express.Router();

const { supportDocumentController } = require("../controllers/supportDocument.controller");

router.get("/", supportDocumentController.getSupportDocument);
router.get("/:documentId", supportDocumentController.getSupportDocumentById);
router.post("/", supportDocumentController.createSupportDocument);
router.post("/json/:documentId", supportDocumentController.createSupportDocumentJson);

module.exports = router;
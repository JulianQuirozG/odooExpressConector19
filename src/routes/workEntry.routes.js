const router = require('express').Router();
const workEntryController = require('../controllers/workEntries.controller');

router.get("/", workEntryController.getWorkEntries);

module.exports = router;
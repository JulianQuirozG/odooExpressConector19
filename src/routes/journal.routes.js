const express = require('express');
const { journalController } = require('../controllers/journal.controller');

const router = express.Router();

// Rutas para diarios
router.get('/', journalController.getJournals);
router.get('/:id', journalController.getOneJournal);

module.exports = router;
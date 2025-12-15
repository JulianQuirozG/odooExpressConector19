const express = require('express');
const accountController = require('../controllers/account.controller');
const router = express.Router();

// Rutas para account.account
router.get('/', accountController.getAccounts);
router.get('/code/:code', accountController.getOneAccountByCode);
router.get('/:id', accountController.getOneAccount);
router.post('/', accountController.createAccount);
router.post('/validate', accountController.validateAccounts);

module.exports = router;

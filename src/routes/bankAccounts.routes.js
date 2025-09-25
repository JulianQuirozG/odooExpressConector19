const express = require('express');
const bankAccountController = require('../controllers/bankAccounts.controller');
const router = express.Router();

    //Aqui van las rutas de bank
    router.get('/', bankAccountController.getBanksAccounts);
    router.get('/:id', bankAccountController.getOneBankAccount);
    router.post('/', bankAccountController.createBankAccount);
    router.put('/:id', bankAccountController.updateBankAccount);
    router.delete('/:id', bankAccountController.deleteBankAccount);

module.exports = router;
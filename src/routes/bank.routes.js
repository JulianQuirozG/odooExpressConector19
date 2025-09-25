const express = require('express');
const bankController = require('../controllers/bank.controller');
const router = express.Router();

    //Aqui van las rutas de bank
    router.get('/', bankController.getBanks);
    router.get('/:id', bankController.getOneBank);
    router.post('/', bankController.createBank);
    router.put('/:id', bankController.updateBank);
    router.delete('/:id', bankController.deleteBank);
    router.get('/search/by-name', bankController.getBankByName);

module.exports = router;
const express = require('express');
const quotationController = require('../controllers/quotation.controller');
const router = express.Router();

    //Aqui van las rutas de quotation
    router.get('/', quotationController.getQuotation);
    router.get('/:id', quotationController.getOneQuotation);
    router.post('/', quotationController.createQuotation);


module.exports = router;
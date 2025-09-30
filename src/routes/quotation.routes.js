const express = require('express');
const quotationController = require('../controllers/quotation.controller');
const router = express.Router();

//Middleware
const validateBody = require('../middleware/validateBody.middleware');

//Schema
const createQuotationSchema = require('../schemas/Quotation/createQuotation.schema');

    //Aqui van las rutas de quotation
    router.get('/', quotationController.getQuotation);
    router.get('/:id', quotationController.getOneQuotation);
    router.post('/', validateBody.validateBody(createQuotationSchema), quotationController.createQuotation);


module.exports = router;
const express = require('express');
const quotationController = require('../controllers/quotation.controller');
const router = express.Router();

//Middleware
const {validateBody} = require('../middleware/validateBody.middleware');

//Schema
const {createQuotationSchema} = require('../schemas/Quotation/createQuotation.schema');

    //Aqui van las rutas de quotation
    router.get('/', quotationController.getQuotation);
    router.post('/update-lines-payload-external/:quotationExternalId', quotationController.updateQuotationLinesFromPayloadByExternalIds);
    router.put('/reset-external/:externalId', quotationController.resetToDraftQuotationByExternalId);
    router.put('/cancel-external/:externalId', quotationController.cancelQuotationByExternalId);
    router.get('/:id', quotationController.getOneQuotation);
    router.post('/', validateBody(createQuotationSchema), quotationController.createQuotation);


module.exports = router;
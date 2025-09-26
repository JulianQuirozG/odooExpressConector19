const express = require('express');
const partnerController = require('../controllers/partener.controller');
const router = express.Router();

    //Aqui van las rutas de partner
    router.get('/', partnerController.getPartners);
    router.get('/customers/', partnerController.getPartnersCustomers);
    router.get('/proveedores/', partnerController.getPartnersProveedores);
    router.get('/:id', partnerController.getOnePartner);
    router.post('/', partnerController.createPartner);
    router.put('/:id', partnerController.updatePartner);   
    router.delete('/:id', partnerController.deletePartner);
    router.post('/with-account', partnerController.createPartnerWithAccount);

module.exports = router;
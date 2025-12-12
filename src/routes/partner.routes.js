const express = require('express');
const partnerController = require('../controllers/partener.controller');
const { validateBody } = require('../middleware/validateBody.middleware');
const router = express.Router();
const { clientSchema } = require('../schemas/client.schema');

    //Aqui van las rutas de partner
    router.get('/', partnerController.getPartners);
    router.get('/customers/', partnerController.getPartnersCustomers);
    router.get('/proveedores/', partnerController.getPartnersProveedores);
    router.get('/external/:externalId', partnerController.getPartnerByExternalId);
    router.get('/:id', partnerController.getOnePartner);
    router.post('/', validateBody(clientSchema), partnerController.createPartner);
    router.put('/external/:externalId', partnerController.updatePartnerByExternalId);
    router.put('/:id', partnerController.updatePartner);   
    router.delete('/:id', partnerController.deletePartner);
    router.post('/with-account', validateBody(clientSchema), partnerController.createPartnerWithAccount);

module.exports = router;
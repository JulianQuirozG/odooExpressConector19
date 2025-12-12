const express = require('express');
const router = express.Router();
const {masterController} = require('../controllers/masters.controller');


router.get('/countries', masterController.getContries);
router.get('/states/:countryId', masterController.getStatesByCountryId);
router.get('/cities/:stateId', masterController.getCityByStateId);

//Terminos de pago partner
router.get('/payment-terms', masterController.getPaymentTermsPartner);
router.get('/payment-methods', masterController.getPaymentMethodsPartner);

//Regimenes fiscales
router.get('/fiscal-obligations', masterController.getFiscalObligations);
router.get('/fiscal-regimes', masterController.getFiscalRegimes);

module.exports = router;
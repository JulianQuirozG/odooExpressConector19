const express = require('express');
const billController = require('../controllers/bill.controller');
const router = express.Router();

    //Aqui van las rutas de bill
    router.get('/', billController.getBill);
    router.get('/:id', billController.getOneBill);
    router.post('/', billController.createBill);
    router.put('/:id', billController.updateBill);
    router.delete('/:id', billController.deleteBill);
    router.put('/confirm/:id', billController.confirmBill);
    router.put('/reset/:id', billController.resetToDraftBill);
    router.post('/debit-note/:id', billController.debitNote);
    router.post('/credit-note/:id', billController.creditNote);
    
module.exports = router;
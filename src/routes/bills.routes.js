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
    
module.exports = router;
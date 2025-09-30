const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrder.controller');
const router = express.Router();
//Middleware
const validateBody = require('../middleware/validateBody.middleware');
//Schema

//rutas de purchase order
router.get('/', purchaseOrderController.getPurchaseOrders);
router.get('/:id', purchaseOrderController.getPurchaseOrderById);
router.post('/', purchaseOrderController.createPurchaseOrder);
router.put('/:id', purchaseOrderController.updatePurchaseOrder);
router.put('/editRows/:id', purchaseOrderController.updatePurchaseOrderLines);

module.exports = router;
const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrder.controller');
const router = express.Router();
//Middleware
const validateBody = require('../middleware/validateBody.middleware');
//Schema

//rutas de purchase order
router.get('/', purchaseOrderController.getPurchaseOrders);
router.get('/detail/:id', purchaseOrderController.getPurchaseOrderWithLinesDetail);
router.get('/:id', purchaseOrderController.getPurchaseOrderById);
router.post('/', purchaseOrderController.createPurchaseOrder);
router.put('/:id', purchaseOrderController.updatePurchaseOrder);
router.put('/editRows/:id', purchaseOrderController.updatePurchaseOrderLines);
router.post('/update-lines-payload-external/:purchaseOrderExternalId', purchaseOrderController.updatePurchaseOrderLinesFromPayloadByExternalIds);
router.put('/update-lines/:id', purchaseOrderController.updatePurchaseOrderLinesFromPayload);
router.post('/confirm/:id', purchaseOrderController.confirmPurchaseOrder);
router.post('/create-bill', purchaseOrderController.createBillFromPurchaseOrder);
router.post('/validListId', purchaseOrderController.validListId);
router.post('/verifyStock/:id', purchaseOrderController.verifyAndUpdatePurchaseOrderLines);
router.put('/cancel/:id', purchaseOrderController.cancelPurchaseOrder);
router.put('/cancel-external/:externalId', purchaseOrderController.cancelPurchaseOrderByExternalId);
router.put('/reset/:id', purchaseOrderController.resetToDraftPurchaseOrder);
router.put('/reset-external/:externalId', purchaseOrderController.resetToDraftPurchaseOrderByExternalId);

module.exports = router;
const express = require('express');
const billController = require('../controllers/bill.controller');
const router = express.Router();

//Middleware
const { validateBody } = require('../middleware/validateBody.middleware');

//Schemas
const createCreditNoteSchema = require('../schemas/CreditNotes/createCreditNote.schema');
const createdPaymentSchema = require('../schemas/Payments/createPayment.schema');
const { controlCron } = require('../middleware/LogLotesFacturas');

//Aqui van las rutas de bill
router.get('/', billController.getBill);
router.post('/update-lines-payload-external/:billExternalId', billController.updateBillLinesFromPayloadByExternalIds);
router.put('/confirm-external/:externalId', billController.confirmBillByExternalId);
router.get('/external/:externalId', billController.getBillByExternalId);
router.get('/:id', billController.getOneBill);
router.post('/', billController.createBill);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);
router.put('/confirm/:id', billController.confirmBill);
router.put('/reset/:id', billController.resetToDraftBill);
router.put('/cancel/:id', billController.cancelBill);
router.post('/debit-note/:id', billController.debitNote);
router.post('/credit-note/:id', validateBody(createCreditNoteSchema), billController.creditNote);
router.post('/payment/:invoiceId', validateBody(createdPaymentSchema), billController.createPayment);
router.get('/outstanding-credits/:invoiceId', billController.listOutstandingCredits);
router.post('/apply-credits/:invoiceId', billController.applyCreditNote);
router.put('/verify-lines/:id', billController.verifyBillLines);
router.get('/dian-json/:id', billController.getBillDianJson);
router.put('/confirm-credit-note/:id', billController.confirmCreditNote);
router.post('/apply-payment/:invoiceExternalId/:paymentExternalId', billController.applyPaymentPendingCredits);
router.get('/invoice-payments/:invoiceId', billController.listInvoicePayments);
router.post('/remove-payment/:invoiceId/:partialId', billController.removeOutstandingPartial);
router.post('/remove-payment-external/:invoiceExternalId/:paymentExternalId', billController.removeOutstandingPartialByExternalId);
router.post('/release/:invoiceBillExternalId', billController.releaseBillPaymentsAndPO);


module.exports = router;
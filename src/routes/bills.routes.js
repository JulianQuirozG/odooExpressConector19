const express = require('express');
const billController = require('../controllers/bill.controller');
const router = express.Router();

//Middleware
const { validateBody } = require('../middleware/validateBody.middleware');

//Schemas
const createCreditNoteSchema = require('../schemas/CreditNotes/createCreditNote.schema');
const createdPaymentSchema = require('../schemas/Payments/createPayment.schema');

//Aqui van las rutas de bill
router.get('/', billController.getBill);
router.get('/:id', billController.getOneBill);
router.post('/', billController.createBill);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);
router.put('/confirm/:id', billController.confirmBill);
router.put('/reset/:id', billController.resetToDraftBill);
router.post('/debit-note/:id', billController.debitNote);
router.post('/credit-note/:id', validateBody(createCreditNoteSchema), billController.creditNote);
router.post('/payment/:invoiceId', validateBody(createdPaymentSchema), billController.createPayment);
router.get('/outstanding-credits/:invoiceId', billController.listOutstandingCredits);
router.post('/apply-credits/:invoiceId', billController.applyCreditNote);
router.put('/verify-lines/:id', billController.verifyBillLines);

module.exports = router;
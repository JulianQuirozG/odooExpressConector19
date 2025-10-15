const express = require('express');
const router = express.Router();

// Import the controller
const  payrollController  = require('../controllers/payroll.controller');

router.get('/getJsonPayrollById/:id', payrollController.getJsonPayrollById);
router.get('/getpayrollById/:id', payrollController.getPayrollById);
router.get('/getPayrollsByDates', payrollController.getPayrollsByDates);

module.exports = router;
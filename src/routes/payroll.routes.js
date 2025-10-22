const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer.config');
const { reportPayrollsByExcel } = require('../middleware/reportPayrollsByExcel');

// Import the controller
const payrollController = require('../controllers/payroll.controller');

router.get('/getJsonPayrollById/:id', payrollController.getJsonPayrollById);
router.get('/getpayrollById/:id', payrollController.getPayrollById);
router.get('/getPayrollsByDates', payrollController.getPayrollsByDates);
router.post('/reportPayrollsByDates', payrollController.reportPayrollsByDates);
router.post('/reportPayrollsByExcel', upload.single('file'), reportPayrollsByExcel, payrollController.reportPayrollsByExcel);
module.exports = router;
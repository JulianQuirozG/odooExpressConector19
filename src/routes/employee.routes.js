const express = require('express');
const router = express.Router();

// Import the controller
const  employeeController  = require('../controllers/employee.controller');

router.get('/getEmployeeById/:id', employeeController.getEmployeeById);

module.exports = router;
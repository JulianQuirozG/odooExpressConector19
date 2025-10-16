//import services
const payrollService = require('../services/payroll.service');

const payrollController = {
    async getJsonPayrollById(req, res) {
        try {
            const payrollId = req.params.id;
            const result = await payrollService.getJsonPayrollById(payrollId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en payrollController.getJsonPayrollById:', error);
            res.status(500).json({ message: 'Error al obtener la nómina por ID', error: error.message });
        }
    },

    async getPayrollById(req, res) {
        try {
            const payrollId = req.params.id;
            const result = await payrollService.getpayrollById(payrollId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en payrollController.getJsonPayrollById:', error);
            res.status(500).json({ message: 'Error al obtener la nómina por ID', error: error.message });
        }
    },

    async getPayrollsByDates(req, res) {
        try {
            const {start_date, end_date} = req.query;
            const result = await payrollService.getPayrollsByDates(start_date, end_date);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en payrollController.getPayrolls:', error);
            res.status(500).json({ message: 'Error al obtener las nóminas', error: error.message });
        }
    }
    ,

    async reportPayrollsByDates(req, res) {
        try {
            const {start_date, end_date} = req.query;
            const result = await payrollService.reportPayrollsByDates(start_date, end_date);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en payrollController.getPayrolls:', error);
            res.status(500).json({ message: 'Error al obtener las nóminas', error: error.message });
        }
    }
}

module.exports = payrollController;
//import services
const employeeService = require('../services/employee.service');

const employeeController = {
    async getEmployeeById(req, res) {
        try {
            const employeeId = req.params.id;
            const result = await employeeService.getEmployeeById(employeeId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en employeeController.getEmployeeById:', error);
            res.status(500).json({ message: 'Error al obtener el empleado por ID', error: error.message });
        }
    }
}

module.exports = employeeController;
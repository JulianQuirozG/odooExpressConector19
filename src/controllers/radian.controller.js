const radianService = require("../services/radian.service");


const radianController = {
    async sendRadianData(req, res) {
        try {
            const result = await radianService.sendRadianData(req.body);
            return res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en radianController.sendRadianData:', error);
            res.status(500).json({ message: 'Error al enviar datos a Radian', error: error.message });
        }
    }
}

module.exports = radianController;
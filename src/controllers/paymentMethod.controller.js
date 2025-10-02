const { methodPaymenthService } = require("../services/methodPaymenth.service");

const paymentMethodController = {

    async getPaymentMethods(req, res) {
        try {
            const result = await methodPaymenthService.getPaymentMethods();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en paymentMethodController.getPaymentMethods:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener métodos de pago', error: error.message });
        }
    },
    async getOnePaymentMethod(req, res) {
        const { id } = req.params;
        try {
            const result = await methodPaymenthService.getOnePaymentMethod(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en paymentMethodController.getOnePaymentMethod:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener método de pago', error: error.message });
        }
    }
}
module.exports = { paymentMethodController };
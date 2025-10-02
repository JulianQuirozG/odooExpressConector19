const { currencyService } = require("../services/currency.service");

const currencyController = {

    async getCurrency(req, res) {
        try {
            const result = await currencyService.getCurrency();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en currencyController.getCurrency:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener monedas', error: error.message });
        }
    },
    async getOneCurrency(req, res) {
        const { id } = req.params;
        try {
            const result = await currencyService.getOneCurrency(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en currencyController.getOneCurrency:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener moneda', error: error.message });
        }
    }
}
module.exports = { currencyController };
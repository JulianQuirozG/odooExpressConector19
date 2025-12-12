
const {mastersService} = require("../services/masters.service");
const masterController = {
    async getContries(req, res) {
        try {
            const result = await mastersService.getContries();
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en mastersController.getContries:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener países', error: error.message });
        }
    },

    async getStatesByCountryId(req, res) {
        try {
            const {countryId} = req.params;
            const result = await mastersService.getStatesByCountryId(countryId);
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en mastersController.getStatesByCountryId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener estados por país', error: error.message });
        }
    },

    async getCityByStateId(req, res) {
        try {
            const {stateId} = req.params;
            const result = await mastersService.getCityByStateId(stateId);
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en mastersController.getCityByStateId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener ciudades por estado', error: error.message });
        }
    },

    async getPaymentTermsPartner(req, res) {
        try {
            const result = await mastersService.getPaymentTermsPartner();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en mastersController.getPaymentTermsPartner:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener términos de pago', error: error.message });
        }
    },

    async getFiscalObligations(req, res) {
        try {
            const result = await mastersService.getFiscalObligations();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en mastersController.getFiscalObligations:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener regímenes fiscales', error: error.message });
        }
    },

    async getFiscalRegimes(req, res) {
        try {
            const result = await mastersService.getFiscalRegimes();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en mastersController.getFiscalRegimes:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener regímenes fiscales', error: error.message });
        }
    },

    async getPaymentMethodsPartner(req, res) {
        try {
            const result = await mastersService.getPaymentMethodsPartner();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en mastersController.getPaymentMethodsPartner:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener métodos de pago', error: error.message });
        }
    }
}

module.exports = { masterController }; 
const partnerService = require("../services/partner.service");
const { CLIENT_FIELDS } = require("../utils/fields");


const partnerController = {
    async getPartners(req, res) {
        try {
            const result = await partnerService.getPartners(CLIENT_FIELDS);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.getPartners:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener partners', error: error.message });
        }
    },
    async getPartnersCustomers(req, res) {
        try {
            const result = await partnerService.getPartners(CLIENT_FIELDS, [['customer_rank', '>', 0]]);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.getPartnersCustomers:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener partners', error: error.message });
        }
    },
    async getPartnersProveedores(req, res) {
        try {
            const result = await partnerService.getPartners(CLIENT_FIELDS, [['supplier_rank', '>', 0]]);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.getPartnersProveedores:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener partners', error: error.message });
        }
    },
    async getOnePartner(req, res) {
        const { id } = req.params;
        try {
            const result = await partnerService.getOnePartner(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.getOnePartner:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener partner', error: error.message });
        }
    },
    async getPartnerByExternalId(req, res) {
        const { externalId } = req.params;
        try {
            const result = await partnerService.getPartnerByExternalId(externalId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.getPartnerByExternalId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener partner por External ID', error: error.message });
        }
    },
    async createPartner(req, res) {
        try {
            const result = await partnerService.createPartner(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.createPartner:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear partner', error: error.message });
        }
    },
    async updatePartner(req, res) {
        try {
            const { id } = req.params;
            const result = await partnerService.updatePartner(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.updatePartner:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar partner', error: error.message });
        }
    },
    async updatePartnerByExternalId(req, res) {
        try {
            const { externalId } = req.params;
            const result = await partnerService.updatePartnerByExternalId(externalId, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.updatePartnerByExternalId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar partner por External ID', error: error.message });
        }
    },
    async deletePartner(req, res) {
        try {
            const { id } = req.params;
            const result = await partnerService.deletePartner(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.deletePartner:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al eliminar partner', error: error.message });
        }
    },
    async createPartnerWithAccount(req, res) {
        try {
            const result = await partnerService.createPartnerWithAccount(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en partnerController.createPartnerWithAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear partner con cuenta', error: error.message });
        }
    },
}

module.exports = partnerController;

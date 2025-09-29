const quotationService = require("../services/quotation.service");


const quotationController = {
    async getQuotation(req, res) {
        try {
            const result = await quotationService.getQuotation();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en quotationController.getQuotation:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener cotizaciones', error: error.message });
        }
    },
    async getOneQuotation(req, res) {
        const { id } = req.params;
        try {
            const result = await quotationService.getOneQuotation(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en quotationController.getOneQuotation:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener cotización', error: error.message });
        }
    },

    async createQuotation(req, res) {
        try {
            const result = await quotationService.createQuotation(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en quotationController.createQuotation:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear cotización', error: error.message });
        }
    },
    /**
    async updateBill(req, res) {
        try{
            const { id } = req.params;
            const result = await billService.updateBill(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.updateBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar factura', error: error.message });
        }
    },
    async deleteBill(req, res) {
        try {
            const { id } = req.params;
            const result = await billService.deleteBill(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.deleteBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al eliminar factura', error: error.message });
        }
    },
    async confirmBill(req, res) {
        try{
            const { id } = req.params;
            const result = await billService.confirmBill(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.confirmBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al confirmar factura', error: error.message });
        }
    }
        */
}

module.exports = quotationController;

const billService = require("../services/bills.service");


const billController = {
    async getBill(req, res) {
        try {
            const result = await billService.getBills();
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en billController.getBills:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener facturas', error: error.message });
        }
    },
    async getOneBill(req, res) {
        const { id } = req.params;
        try {
            const result = await billService.getOneBill(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.getOneBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener factura', error: error.message });
        }
    },
    async createBill(req, res) {
        try {
            const result = await billService.createBill(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.createBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear factura', error: error.message });
        }
    },
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
    },
    async resetToDraftBill(req, res) {
        try{
            const { id } = req.params;
            const result = await billService.resetToDraftBill(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.resetToDraftBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al reestablecer factura a borrador', error: error.message });
        }   
    },
    async debitNote(req, res) {
        try{
            const { id } = req.params;
            const result = await billService.createDebitNote(id,req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.debitNote:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear nota de débito', error: error.message });
        }   
    },
    async creditNote(req, res) {
        try{
            const { id } = req.params;
            const result = await billService.createCreditNote(id,req.body);
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en billController.creditNote:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear nota de crédito', error: error.message });
        }
    }
}

module.exports = billController;

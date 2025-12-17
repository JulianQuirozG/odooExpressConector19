const billService = require("../services/bills.service");


const billController = {
    async getBill(req, res) {
        try {
            const result = await billService.getBills();
            res.status(result.statusCode).json(result);
        } catch (error) {
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
    async getBillByExternalId(req, res) {
        const { externalId } = req.params;
        try {
            const result = await billService.getBillByExternalId(externalId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.getBillByExternalId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener factura por External ID', error: error.message });
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
        try {
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
        try {
            const { id } = req.params;
            const result = await billService.confirmBill(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.confirmBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al confirmar factura', error: error.message });
        }
    },
    async resetToDraftBill(req, res) {
        try {
            const { id } = req.params;
            const result = await billService.resetToDraftBill(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.resetToDraftBill:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al reestablecer factura a borrador', error: error.message });
        }
    },
    async debitNote(req, res) {
        try {
            const { id } = req.params;
            // const result = await billService.createDebitNote(id, req.body);
            console.log( 'ID recibido para nota de débito:', id);
            console.log('Datos recibidos para nota de débito:', req.body);
            const result = await billService.createDebitNoteByExternalId(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.debitNote:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear nota de débito', error: error.message });
        }
    },
    async creditNote(req, res) {
        try {
            const { id } = req.params;
            //const result = await billService.createCreditNote(id, req.body);
            console.log('ID recibido para nota de crédito:', id);
            console.log('Datos recibidos para nota de crédito:', req.body);
            const result = await billService.createCreditNoteByExternalId(id, req.body);

            console.log('Resultado de createCreditNoteByExternalId:', result);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.creditNote:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear nota de crédito', error: error.message });
        }
    },
    async createPayment(req, res) {
        try {
            const { invoiceId } = req.params;
            const result = await billService.createPayment(invoiceId, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.createPayment:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear pago', error: error.message });
        }
    },
    async listOutstandingCredits(req, res) {
        try {
            const { invoiceId } = req.params;
            const result = await billService.listOutstandingCredits(invoiceId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.listOutstandingCredits:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener notas de crédito pendientes', error: error.message });
        }
    },
    async applyCreditNote(req, res) {
        try {
            const { invoiceId } = req.params;
            const { creditNoteId } = req.body;
            const result = await billService.applyCreditNote(invoiceId, creditNoteId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.applyCreditNoteToInvoice:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al aplicar nota de crédito a la factura', error: error.message });
        }
    },
    async verifyBillLines(req, res) {
        try {
            const { id } = req.params;
            const { invoice_line_ids } = req.body;
            const result = await billService.verifyBillLines(id, invoice_line_ids);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.verifyBillLines:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al verificar líneas de la factura', error: error.message });
        }
    },
    async getBillDianJson(req, res) {
        try {
            const { id } = req.params;
            const result = await billService.createJsonDian(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.getBillDianJson:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener JSON DIAN de la factura', error: error.message });
        }
    },
    async confirmCreditNote(req, res) {
        try {
            const { id } = req.params;
            const result = await billService.confirmCreditNote(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en billController.confirmCreditNote:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al confirmar nota de crédito', error: error.message });
        }
    }
}

module.exports = billController;

const saleService = require('../services/sale.service');

const saleController = {
    // Controlador para obtener todas las ventas
    async getSales(req, res) {
        try {
            const result = await saleService.getSales();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al obtener las ventas', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener ventas', error: error.message });
        }
    },

    // Controlador para obtener una venta por ID
    async getSaleById(req, res) {
        const { id } = req.params;
        try {
            const result = await saleService.getSaleById(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al obtener la venta por ID', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener venta', error: error.message });
        }
    },

    async createBillFromSalesOrder(req, res) {
        const { saleOrderId } = req.body;
        try {
            const result = await saleService.createBillFromSalesOrder(saleOrderId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al crear la factura desde la orden de venta', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear factura desde orden de venta', error: error.message });
        }
    },

    //controlador para crear una venta
    async createSale(req, res) {
        const saleData = req.body;
        try {
            const result = await saleService.createSale(saleData);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al crear la venta', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear venta', error: error.message });
        }
    },

    // Controlador para actualizar líneas de venta
    async updateSaleLines(req, res) {
        const { data, quotationExternalId, purchaseOrderExternalId, purchaseBillExternalId } = req.body;
        try {
            const result = await saleService.updateSaleLines(data, quotationExternalId, purchaseOrderExternalId, purchaseBillExternalId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al actualizar líneas de venta', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar líneas de venta', error: error.message });
        }
    },

    // Controlador para actualizar líneas de venta por x_studio_n_remesa
    async updateSaleLinesXRemesa(req, res) {
        const { data, quotationExternalId, purchaseOrderExternalId, purchaseBillExternalId } = req.body;
        try {
            const result = await saleService.updateSaleLinesXRemesa(data, quotationExternalId, purchaseOrderExternalId, purchaseBillExternalId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al actualizar líneas de venta por x_studio_n_remesa', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar líneas de venta por x_studio_n_remesa', error: error.message });
        }
    }
};

module.exports = saleController;

const { validListId } = require('../services/products.service');
const purchaseOrderService = require('../services/purchaseOrder.service');


const purchaseOrderController = {
    async getPurchaseOrders(req, res) {
        try {
            const result = await purchaseOrderService.getPurchaseOrders(req.query.domain);
            res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.getPurchaseOrders:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener ordenes de compra', error: error.message });
        }
    },
    async getPurchaseOrderById(req, res) {
        try {
            const result = await purchaseOrderService.getPurchaseOrderById(req.params.id);
            res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.getPurchaseOrderById:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener orden de compra', error: error.message });
        }
    },
    async createPurchaseOrder(req, res) {
        try {
            const result = await purchaseOrderService.createPurchaseOrder(req.body);
            res.status(200).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.createPurchaseOrder:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear orden de compra', error: error.message });
        }
    },
    async updatePurchaseOrder(req, res) {
        try {
            const result = await purchaseOrderService.updatePurchaseOrder(req.params.id, req.body);
            res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.updatePurchaseOrder:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar orden de compra', error: error.message });
        }
    },
    async updatePurchaseOrderLines(req, res) {
        try {
            const { id } = req.params;
            const { action, lines } = req.body;
            const result = await purchaseOrderService.updatePurchaseOrderLines(id, action, lines);
            res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.updatePurchaseOrderLines:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar las líneas de la orden de compra', error: error.message });
        }
    },
    async confirmPurchaseOrder(req, res) {
        try {
            const { id } = req.params;
            const result = await purchaseOrderService.confirmPurchaseOrder(id);
            res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.confirmPurchaseOrder:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al confirmar la orden de compra', error: error.message });
        }
    },
    async createBillFromPurchaseOrder(req, res) {
        try {
            const { id } = req.body;
            const result = await purchaseOrderService.createBillFromPurchaseOrder(id);
            res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error en purchaseOrderController.createBillFromPurchaseOrder:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear factura desde la orden de compra', error: error.message });
        }
    },
    async validListId(req, res) {   
        try {
            const { listId } = req.body;
            const result = await purchaseOrderService.validListId(listId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en purchaseOrderController.validListId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al validar lista de precios', error: error.message });
        }   
    }

};

module.exports = purchaseOrderController;
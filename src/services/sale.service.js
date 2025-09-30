const salesFields = ["name", "partner_id", "date_order", "amount_total", "state"];
const odooConector = require("../utils/odoo.service");

//Services
const quotationService = require("./quotation.service");

const saleService = {
    async getSales() {
        try {
            //Obtener todas las ordenes de venta 
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "search_read",
                {
                    fields: salesFields,
                    domain: [["state", "in", ["sale", "done"]]],
                    limit: 80
                }
            );
            if (response.error) return { statusCode: 500, message: 'Error al obtener ventas', error: response.message };
            if (!response.success) return { statusCode: 400, message: 'Error al obtener ventas', data: response.data };

            //Regresar las ventas obtenidas
            return {
                statusCode: 200, message: 'Lista de ventas', data: response.data
            };
        } catch (error) {
            console.error('Error al obtener las ventas desde Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al obtener ventas',
                error: error.message
            };
        }
    },

    async getSaleById(id) {
        try {
            // Obtener una orden de venta por ID
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "search_read",
                {
                    fields: salesFields,
                    domain: [["state", "in", ["sale", "done"]], ["id", "=", id]],
                    limit: 1
                }
            );

            if (response.error) return { statusCode: 500, message: 'Error al obtener venta', error: response.message };
            if (!response.success) return { statusCode: 400, message: 'Error al obtener venta', data: response.data };
            if (response.data.length === 0) return { statusCode: 404, message: 'Venta no encontrada' };

            // Regresar la venta obtenida
            return {
                statusCode: 200,
                message: 'Detalle de la venta',
                data: response.data
            };
        } catch (error) {
            console.error('Error al obtener la venta por ID desde Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al obtener venta',
                error: error.message
            };
        }
    },

    async createSale(data) {
        try {
            //preparamos la informacion de la venta y de la compra
            const { dataVenta, dataCompra } = data;

            //crear cotizacion
            const quotation = await quotationService.createQuotation(dataVenta);
            if (quotation.statusCode !== 201) return quotation;

            //confirmar cotizacion 
            const confirmQuotation = await quotationService.confirmQuotation(quotation.data.id);
            if (confirmQuotation.statusCode !== 200) return confirmQuotation;

            // Recuperar la información de la orden de compra generada al confirmar la cotización
            const purchaseOrder = await quotationService.getPurchaseOrderBySaleOrderId(quotation.data.id);
            if (purchaseOrder.statusCode !== 200) return purchaseOrder;

            console.log("Órdenes de compra relacionadas:", purchaseOrder.data);
            //actualizar orden de compra 
            //Regresar la informacion de la orden de venta final con orden de compra

            const sale = await this.getSaleById(quotation.data.id);
            if (sale.statusCode !== 200) return sale;
            return {
                statusCode: 201,
                data: sale.data
            };
        } catch (error) {
            console.error('Error al crear la venta en Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al crear venta',
                error: error.message
            };
        }
    }
};

module.exports = saleService;

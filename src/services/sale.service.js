const salesFields = ["name", "partner_id", "date_order", "amount_total", "state", "name"];
const odooConector = require("../utils/odoo.service");

//Services
const quotationService = require("./quotation.service");
const purchaseOrderService = require("./purchaseOrder.service");
const billService = require("./bills.service");

const saleService = {
    /**
     * Obtiene todas las órdenes de venta (sale.order) en estado 'sale' o 'done' desde Odoo.
     *
     * @async
     * @returns {Promise<Object>} Resultado con statusCode, data (array de ventas) y mensaje. Si hay error, incluye el mensaje y el error.
     *
     */
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

    /**
     * Obtiene el detalle de una orden de venta (sale.order) por su ID desde Odoo.
     *
     * @async
     * @param {number} id - ID de la orden de venta a consultar.
     * @returns {Promise<Object>} Resultado con statusCode, data (detalle de la venta) y mensaje. Si hay error, incluye el mensaje y el error.
     *
     */
    async getSaleById(id) {
        try {
            // Validar el ID de la venta
            if (isNaN(Number(id))) return { statusCode: 400, message: 'ID de venta inválido', data: [] };
            
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

    /**
     * Crea una orden de venta en Odoo a partir de los datos recibidos.
     *
     *
     * @async
     * @param {Object} data - Datos para crear la venta y la compra.
     * @param {Object} data.dataVenta - Datos de la cotización/venta (partner_id, productos, fechas, etc).
     * @param {Object} data.dataCompra - Datos para actualizar la orden de compra (proveedor, productos, etc).
     * @returns {Promise<Object>} Resultado con statusCode, data y mensaje. Si hay error, incluye el mensaje y el error.
     *
     * Ejemplo de data:
     * {
     *   dataVenta: {
     *     partner_id: 1,
     *     date_order: "2025-09-30",
     *     validity_date: "2025-10-15",
     *     order_line: [ ... ]
     *   },
     *   dataCompra: {
     *     proveedor_id: 2,
     *     order_line: [ ... ]
     *   }
     * }
     */
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
            const purchaseOrder = await quotationService.getPurchaseOrdersBySaleOrderId(quotation.data.id);
            const purchaseOrderId = purchaseOrder.data[0].id;
            if (purchaseOrder.statusCode !== 200) return purchaseOrder;

            //actualizar orden de compra 
            const updatePurchaseOrder = await purchaseOrderService.updatePurchaseOrder(purchaseOrderId, dataCompra, 'update');
            if (updatePurchaseOrder.statusCode !== 200) return updatePurchaseOrder;

            //Confirmar orden de compra
            const confirmPurchaseOrder = await purchaseOrderService.confirmPurchaseOrder(purchaseOrderId);
            if (confirmPurchaseOrder.statusCode !== 200) return confirmPurchaseOrder;

            //Crear factura de la orden de compra
            const createBill = await purchaseOrderService.createBillFromPurchaseOrder([purchaseOrderId]);
            if (createBill.statusCode !== 201) return createBill;

            //Confirmar factura de la orden de compra
            const billId = (await purchaseOrderService.getPurchaseOrderById(purchaseOrderId)).data[0].invoice_ids[0];

            const confirmBill = await billService.confirmBill(billId);
            if (confirmBill.statusCode !== 200) return confirmBill;

            //Regresar la informacion de la orden de venta final con orden de compra
            const sale = await this.getSaleById(quotation.data.id);

            if (sale.statusCode !== 200) return sale;
            return {
                statusCode: 201,
                data: {
                    saleOrder: sale.data[0],
                    purchaseOrder: updatePurchaseOrder.data
                },
                message: 'Venta creada con éxito',
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

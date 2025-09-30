const { pick } = require('../schemas/bill.schema');
const { PURCHASE_ORDER_FIELDS, SALE_ORDER_FIELDS } = require('../utils/fields');
const odooConector = require('../utils/odoo.service');
const { pickFields } = require('../utils/util');
const partnerService = require('./partner.service');
const productService = require('./products.service');

const purchaseOrderService = {
    //obtener todas las ordenes de compra
    async getPurchaseOrders(purchaseOrderFields = ['name', 'partner_id', 'date_order', 'amount_total', 'state']) {
        try {
            const response = await odooConector.executeOdooRequest('purchase.order', 'search_read', {
                fields: purchaseOrderFields
            });
            if (!response.success) {
                throw new Error(response.message);
            }
            return { statusCode: 200, message: 'Ordenes de compra obtenidas', data: response.data };
        } catch (error) {
            console.log('Error en purchaseOrderService.getPurchaseOrders:', error);
            return { statusCode: 500, message: 'Error al obtener ordenes de compra', error: error.message };
        }
    },
    async getPurchaseOrderById(id, purchaseOrderFields = ['name', 'partner_id', 'date_order', 'amount_total', 'state']) {
        try {
            const response = await odooConector.executeOdooRequest('purchase.order', 'search_read', {
                domain: [['id', '=', Number(id)]],
                limit: 1
            });

            if (!response.success) {
                if (response.error) return { statusCode: 500, message: 'Error al obtener orden de compra', error: response.message };
                return { statusCode: 400, message: 'Error al obtener orden de compra', data: response.data };
            }

            if (response.data?.length === 0) {
                return { statusCode: 404, message: 'Orden de compra no encontrada', data: [] };
            }

            return { statusCode: 200, message: 'Orden de compra obtenida', data: response.data };
        } catch (error) {
            console.log('Error en purchaseOrderService.getPurchaseOrderById:', error);
            return { statusCode: 500, message: 'Error al obtener orden de compra', error: error.message };
        }
    },
    //crear una orden de compra
    async createPurchaseOrder(data) {
        try {
            if (data.partner_id) {
                const partnerExist = await partnerService.getOnePartner(data.partner_id);
                if (partnerExist.statusCode !== 200) {
                    return { statusCode: partnerExist.statusCode, message: partnerExist.message, data: partnerExist.data };
                }
            }

            const purchaseOrder = pickFields(data, PURCHASE_ORDER_FIELDS);
            let NotFoundProducts = [];
            // Validar y transformar los datos de entrada según el esquema
            if (data.order_line?.length > 0) {
                const productExist = await productService.validListId(data.order_line.map((line) => { return line.product_id }));
                if (productExist.statusCode !== 200) {
                    return { statusCode: productExist.statusCode, message: productExist.message, data: productExist.data };
                }
                const filterLines = data.order_line.filter((line) => { return productExist.data.foundIds.includes(line.product_id) });
                NotFoundProducts = data.order_line.filter((line) => { return !productExist.data.foundIds.includes(line.product_id) });
                console.log('filterLines', filterLines);

                purchaseOrder.order_line = filterLines.map((line) => { return [0, 0, pickFields(line, SALE_ORDER_FIELDS)] });

            }

            const response = await odooConector.executeOdooRequest(
                "purchase.order",
                "create",
                {
                    vals_list: [purchaseOrder]
                }
            );
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear orden de compra', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear orden de compra', data: response.data };
            }
            return { statusCode: 201, message: 'Orden de compra creada con éxito', data: { purchaseOrder: response.data, NotFoundProducts: NotFoundProducts } };
        } catch (error) {
            console.error("Error creating purchase order:", error);
            throw error;
        }
    },
    //actualizar una orden de compra existente
    async updatePurchaseOrder(id, data) {
        try {
            if (data.partner_id) {
                const partnerExist = await partnerService.getOnePartner(data.partner_id);
                if (partnerExist.statusCode !== 200) {
                    return { statusCode: partnerExist.statusCode, message: partnerExist.message, data: partnerExist.data };
                }
            }

            
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }

            const purchaseOrder = pickFields(data, PURCHASE_ORDER_FIELDS);
            let NotFoundProducts = [];

            // Validar y transformar los datos de entrada según el esquema
            if (data.order_line?.length > 0) {
                const productExist = await productService.validListId(data.order_line.map((line) => { return line.product_id }));
                if (productExist.statusCode !== 200) {
                    return { statusCode: productExist.statusCode, message: productExist.message, data: productExist.data };
                }
                const filterLines = data.order_line.filter((line) => { return productExist.data.foundIds.includes(line.product_id) });
                NotFoundProducts = data.order_line.filter((line) => { return !productExist.data.foundIds.includes(line.product_id) });
                console.log('filterLines', filterLines);

                purchaseOrder.order_line = filterLines.map((line) => { return [0, 0, pickFields(line, SALE_ORDER_FIELDS)] });

                if (purchaseOrder.order_line.length <= 1) {
                    await this.updatePurchaseOrderLines(id, 5, []); // Elimina todas las líneas existentes
                }
            }
            console.log('purchaseOrder to update:', JSON.stringify(purchaseOrder));

            const response = await odooConector.executeOdooRequest("purchase.order", "write", {
                ids: [Number(id)],
                vals: purchaseOrder
            });

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar orden de compra', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar orden de compra', data: response.data };
            }
            return { statusCode: 200, message: 'Orden de compra actualizada con éxito', data: { updateResult: response.data, NotFoundProducts: NotFoundProducts } };
        } catch (error) {
            console.error("Error updating purchase order:", error);
            throw error;
        }
    },

    /**
     * Actualiza las rows dependiendo de la accción (2) elimina el id de la linea, 
     * (3) desconecta la línea pero no la elimina de la base de datos, 
     * (5) elimina todas las líneas conectadas, 
     * (6) reemplaza todas las líneas con las especificadas
     */
    async updatePurchaseOrderLines(id, action, lines) {
        try {
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }
            const validActions = [2, 3, 5, 6];
            if (!validActions.includes(action)) {
                return { statusCode: 400, message: 'Acción no válida. Use 2 (eliminar), 3 (desconectar), 5 (eliminar todas), o 6 (reemplazar).' };
            }
            let lineCommands = [];
            if (action === 2 || action === 3) {
                if (!lines || !Array.isArray(lines) || lines.length === 0) {
                    return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de líneas para las acciones 2 o 3.' };
                }
            }

            let actions = [action, ...lines];
            if (action === 5) {
                actions = [action];
            }
            const response = await odooConector.executeOdooRequest("purchase.order", "write", {
                ids: [Number(id)],
                vals: {
                    order_line: [actions]
                }
            });

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar líneas de orden de compra', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar líneas de orden de compra', data: response.data };
            }


            return { statusCode: 200, message: 'Líneas de orden de compra actualizadas con éxito', data: response.data };

        } catch (error) {
            console.error("Error updating purchase order lines:", error);
            return {
                statusCode: 500,
                message: 'Error al actualizar líneas de orden de compra',
                error: error.message
            };
        }
    }
};
module.exports = purchaseOrderService;
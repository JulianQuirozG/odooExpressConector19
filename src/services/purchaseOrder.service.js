const { pick } = require('../schemas/bill.schema');
const { PURCHASE_ORDER_FIELDS, SALE_ORDER_FIELDS } = require('../utils/fields');
const odooConector = require('../utils/odoo.service');
const { pickFields } = require('../utils/util');
const { createBill } = require('./bills.service');
const partnerService = require('./partner.service');
const productService = require('./products.service');

const purchaseOrderService = {
    //obtener todas las ordenes de compra
    async getPurchaseOrders(purchaseOrderFields = ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'invoice_ids']) {
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
    async getPurchaseOrderById(id, purchaseOrderFields = ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line']) {
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
    //actualizar una orden de compra existente, recibe el id del pedido y los datos a actualizar, ademas una opcion de accion (replace, update)
    async updatePurchaseOrder(id, data, action = 'replace') {
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
                //consulta los ids de los productos que se enviaron a actualizar 
                const productExist = await productService.validListId(data.order_line.map((line) => { return line.product_id }));

                if (productExist.statusCode !== 200) {
                    return { statusCode: productExist.statusCode, message: productExist.message, data: productExist.data };
                }

                //filtra las lineas que si existen en odoo
                const filterLines = data.order_line.filter((line) => { return productExist.data.foundIds.includes(line.product_id) });
                //filtra las lineas que no existen en odoo
                NotFoundProducts = data.order_line.filter((line) => { return !productExist.data.foundIds.includes(line.product_id) });

                if (action === 'replace') {
                    //eliminar todas las rows existentes y agrega las nuevas
                    purchaseOrder.order_line = filterLines.map((line) => { return [0, 0, pickFields(line, SALE_ORDER_FIELDS)] });
                    if (purchaseOrder.order_line.length <= 1) {
                        console.log('Eliminando todas las líneas existentes antes de agregar la nueva línea', purchaseOrderExists.data[0].order_line);
                        console.log((await this.updatePurchaseOrderLines(id, 2, purchaseOrderExists.data[0].order_line)).data); // Elimina todas las líneas existentes

                    }

                } else if (action === 'update') {
                    // Actualiza las líneas existentes con las nueva información, los tamaños de las rows deber ser iguales para poder verificar
                    await this.verifyAndUpdatePurchaseOrderLines(id, filterLines);
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

    async validListId(purchaseOrderIds) {
        try {
            if (!purchaseOrderIds || !Array.isArray(purchaseOrderIds) || purchaseOrderIds.length === 0) {
                return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de ordenes de compra para validar.' };
            }
            const response = await odooConector.executeOdooRequest('purchase.order', 'search_read', {
                domain: [['id', 'in', purchaseOrderIds]],
                fields: ['id']
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al validar IDs de ordenes de compra', error: response.message };
                }
                return { statusCode: 400, message: 'Error al validar IDs de ordenes de compra', data: response.data };
            }
            console.log('Response from validListId:', response.data);
            const foundIds = response.data.map((po) => { return po.id });
            const notFoundIds = purchaseOrderIds.filter((id) => !foundIds.includes(id));
            return { statusCode: 200, message: 'Validación completada', data: { foundIds, notFoundIds } };
        } catch (error) {
            console.log('Error en purchaseOrderService.validListId:', error);
            return { statusCode: 500, message: 'Error al validar IDs de ordenes de compra', error: error.message };
        }
    },

    /**
     * Actualiza las rows dependiendo de la accción
     * (1) ACTUALIZAR lineas,
     * (2) elimina el id de la linea, 
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
            const validActions = [1, 2, 3, 5, 6];
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
            } else if (action === 2) {
                actions = lines.map((line) => { return [2, line] });
            } else if (action === 1) {
                actions = lines.map((line, index) => { return [1, purchaseOrderExists.data[0].order_line[Number(index)], line] });
            }

            console.log('Actions for updatePurchaseOrderLines:', actions);
            const response = await odooConector.executeOdooRequest("purchase.order", "write", {
                ids: [Number(id)],
                vals: {
                    order_line: actions
                }
            });
            console.log('Response from updatePurchaseOrderLines:', response);
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
    },

    //recibe el id de la orden de compra y una lista de lineas [{id:1,product_id:12}{id:1,product_id:13}] a verificar
    async verifyAndUpdatePurchaseOrderLines(id, lines = []) {
        try {
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }

            //verificamos que la lista de lineas a verificar correspondan en size
            if ((!lines || lines.length === 0) || lines.length !== purchaseOrderExists.data[0].order_line.length) {
                return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de líneas para verificar y actualizar.' };
            }

            const response = await this.updatePurchaseOrderLines(id, 1, lines);

            if (response.statusCode !== 200) {
                return { statusCode: response.statusCode, message: response.message, data: response.data };
            }

            return { statusCode: 200, message: 'Líneas de orden de compra verificadas y actualizadas con éxito', data: response.data };

        } catch (error) {
            console.error("Error in verifyAndUpdatePurchaseOrderLines:", error);
            return {
                statusCode: 500,
                message: 'Error al verificar y actualizar líneas de orden de compra',
                error: error.message
            };
        }
    },

    async confirmPurchaseOrder(id) {
        try {
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }
            const response = await odooConector.executeOdooRequest("purchase.order", "button_confirm", {
                ids: [Number(id)]
            });

            console.log('Response from confirmPurchaseOrder:', response);

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al confirmar orden de compra', error: response.message };
                }
                return { statusCode: 400, message: 'Error al confirmar orden de compra', data: response.data };
            }
            return { statusCode: 200, message: 'Orden de compra confirmada con éxito', data: response.data };
        } catch (error) {
            console.error("Error confirming purchase order:", error);
            return {
                statusCode: 500,
                message: 'Error al confirmar orden de compra',
                error: error.message
            };
        }
    },
    async createBillFromPurchaseOrder(purchaseOrderId) {
        try {
            if (!purchaseOrderId || !Array.isArray(purchaseOrderId) || purchaseOrderId.length === 0) {
                return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de ordenes de compra para crear facturas.' };
            }
            const idArray = purchaseOrderId.map((id) => { return Number(id) });

            const purchaseOrderExists = await this.validListId(idArray);

            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }
            const idsFound = purchaseOrderExists.data.foundIds.map((id) => { return Number(id) });

            if (idsFound.length === 0) {
                return { statusCode: 404, message: 'Ninguna de las ordenes de compra proporcionadas fue encontrada.', data: [] };
            }
            console.log('idsFound for creating bills:', idsFound);
            const newBill = await odooConector.executeOdooRequest('purchase.order', 'action_create_invoice', {
                ids: idsFound
            });

            if (!newBill.success) {
                if (newBill.error) {
                    return { statusCode: 500, message: 'Error al crear factura desde orden de compra', error: newBill.message };
                }
                return { statusCode: newBill.statusCode, message: newBill.message, data: newBill.data };
            }

            return { statusCode: 201, message: 'Factura creada con éxito', data: newBill.data };

        } catch (error) {
            console.error("Error creating bill from purchase order:", error);
            return {
                statusCode: 500,
                message: 'Error al crear factura desde orden de compra',
                error: error.message
            };
        }
    }
};
module.exports = purchaseOrderService;
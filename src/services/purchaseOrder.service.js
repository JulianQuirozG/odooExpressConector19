const { PURCHASE_ORDER_FIELDS, SALE_ORDER_FIELDS } = require('../utils/fields');
const odooConector = require('../utils/odoo.service');
const { pickFields } = require('../utils/util');
const billService = require('./bills.service');
const partnerService = require('./partner.service');
const productService = require('./products.service');

const purchaseOrderService = {
    /**
     * Obtiene todas las órdenes de compra
     * @async
     * @function getPurchaseOrders
     * @param {string[]} [purchaseOrderFields=['name', 'partner_id', 'date_order', 'amount_total', 'state']] - Campos a obtener
     * @returns {Promise<Object>} Respuesta con las órdenes de compra
     * @returns {number} returns.statusCode - Código de estado HTTP
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Array} returns.data - Array de órdenes de compra
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const result = await purchaseOrderService.getPurchaseOrders(['name', 'partner_id']);
     * if (result.statusCode === 200) {
     *   console.log('Órdenes:', result.data);
     * }
     */
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
    /**
     * Obtiene una orden de compra por su ID
     * @async
     * @function getPurchaseOrderById
     * @param {number|string} id - ID de la orden de compra
     * @param {string[]} [purchaseOrderFields=['name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line']] - Campos a obtener
     * @returns {Promise<Object>} Respuesta con la orden de compra
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 404, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Array|Object} returns.data - Datos de la orden de compra o array vacío si no se encuentra
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const result = await purchaseOrderService.getPurchaseOrderById(123);
     * if (result.statusCode === 200) {
     *   console.log('Orden encontrada:', result.data);
     * } else if (result.statusCode === 404) {
     *   console.log('Orden no encontrada');
     * }
     */
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

            return { statusCode: 200, message: 'Orden de compra obtenida', data: response.data[0] };
        } catch (error) {
            console.log('Error en purchaseOrderService.getPurchaseOrderById:', error);
            return { statusCode: 500, message: 'Error al obtener orden de compra', error: error.message };
        }
    },
    /**
     * Crea una nueva orden de compra
     * @async
     * @function createPurchaseOrder
     * @param {Object} data - Datos de la orden de compra
     * @param {number} [data.partner_id] - ID del proveedor
     * @param {string} [data.name] - Nombre/referencia de la orden
     * @param {string} [data.date_order] - Fecha de la orden
     * @param {Array<Object>} [data.order_line] - Líneas de la orden
     * @param {number} data.order_line[].product_id - ID del producto
     * @param {string} [data.order_line[].name] - Descripción del producto
     * @param {number} [data.order_line[].product_qty] - Cantidad
     * @param {number} [data.order_line[].price_unit] - Precio unitario
     * @returns {Promise<Object>} Respuesta con la orden creada
     * @returns {number} returns.statusCode - Código de estado HTTP (201, 400, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Object} returns.data - Datos de la orden creada y productos no encontrados
     * @returns {Object} returns.data.purchaseOrder - Orden de compra creada
     * @returns {Array} returns.data.NotFoundProducts - Productos que no se encontraron
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const orderData = {
     *   partner_id: 24,
     *   order_line: [
     *     { product_id: 22, product_qty: 5, price_unit: 100 }
     *   ]
     * };
     * const result = await purchaseOrderService.createPurchaseOrder(orderData);
     */
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
    /**
     * Actualiza una orden de compra existente
     * @async
     * @function updatePurchaseOrder
     * @param {number|string} id - ID de la orden de compra a actualizar
     * @param {Object} data - Datos para actualizar
     * @param {number} [data.partner_id] - ID del proveedor
     * @param {Array<Object>} [data.order_line] - Líneas de la orden a actualizar
     * @param {string} [action='replace'] - Acción a realizar ('replace' | 'update')
     * @returns {Promise<Object>} Respuesta con el resultado de la actualización
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 404, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Object} returns.data - Datos de la orden actualizada y productos no encontrados
     * @returns {Object} returns.data.updateResult - Orden de compra actualizada
     * @returns {Array} returns.data.NotFoundProducts - Productos que no se encontraron
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const updateData = {
     *   partner_id: 25,
     *   order_line: [
     *     { product_id: 22, product_qty: 10, price_unit: 150 }
     *   ]
     * };
     * const result = await purchaseOrderService.updatePurchaseOrder(123, updateData, 'replace');
     */
    async updatePurchaseOrder(id, data, action = 'replace') {
        try {
            // Validar que el partner exista, buscando por ID o por External ID
            if (data.partner_id) {
                // Si viene partner_id, buscar por ID
                const partnerExist = await partnerService.getOnePartner(data.partner_id);
                if (partnerExist.statusCode !== 200) {
                    return { statusCode: partnerExist.statusCode, message: partnerExist.message, data: partnerExist.data };
                }
            } else if (data.external_partner_id) {
                // Si no viene partner_id pero sí externalPartnerId, buscar por External ID
                const partnerResponse = await partnerService.getPartnerByExternalId(data.external_partner_id);

                if (partnerResponse.statusCode !== 200) {
                    return {
                        statusCode: partnerResponse.statusCode,
                        message: "No se puede actualizar la orden de compra porque el partner no existe",
                        error: partnerResponse.message || partnerResponse.error,
                    };
                }

                // Si lo encontramos por External ID, asignar el partner_id al data
                data.partner_id = partnerResponse.data.id;
            }
            console.log("Datos a actualizar:", data);

            // Verificar que la orden de compra exista
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }

            // obtengo los datos de la orden a actualizar
            const purchaseOrder = pickFields(data, PURCHASE_ORDER_FIELDS);
            let NotFoundProducts = [];

            // Validar y transformar los datos de entrada según el esquema
            if (data.order_line?.length > 0) {
                //consulta los ids de los productos que se enviaron a actualizar 
                const productExist = await productService.validListId(data.order_line.map((line) => { return line.product_id }));

                if (productExist.statusCode !== 200) {
                    return { statusCode: productExist.statusCode, message: productExist.message, data: productExist.data };
                }
                console.log('productExist', productExist.data);
                //filtra las lineas que si existen en odoo
                const filterLines = data.order_line.filter((line) => { return productExist.data.foundIds.includes(line.product_id) });
                //filtra las lineas que no existen en odoo
                NotFoundProducts = data.order_line.filter((line) => { return !productExist.data.foundIds.includes(line.product_id) });

                //si el action es replace elimina todas las lineas existentes y agrega las nuevas
                if (action === 'replace') {

                    //filtra las lineas a que crear por los ids de produccto que si existen
                    purchaseOrder.order_line = filterLines.map((line) => { return [0, 0, pickFields(line, SALE_ORDER_FIELDS)] });
                    console.log('Reemplazando todas las líneas con las nuevas líneas', purchaseOrder.order_line);

                    //si la orden de compra tiene una sola linea o mas, elimina todas las lineas existentes antes de agregar las nuevas
                    if (purchaseOrder.order_line.length <= 1) {
                        console.log('Eliminando todas las líneas existentes antes de agregar la nueva línea', purchaseOrderExists.data[0].order_line);
                        await this.updatePurchaseOrderLines(id, 2, purchaseOrderExists.data.order_line); // Elimina todas las líneas existentes

                    }

                } else if (action === 'update') {
                    console.log('Actualizando líneas existentes', filterLines);
                    // Actualiza las líneas existentes con las nueva información, los tamaños de las rows deber ser iguales para poder verificar
                    console.log('Actualizando las líneas existentes con las nuevas líneas', filterLines);
                    await this.verifyAndUpdatePurchaseOrderLines(id, filterLines);
                }

            }
            console.log('purchaseOrder to update:', JSON.stringify(purchaseOrder));

            // Realizar la actualización en Odoo
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

            const purchaseOrderUpdated = await this.getPurchaseOrderById(id);

            return { statusCode: 200, message: 'Orden de compra actualizada con éxito', data: { updateResult: purchaseOrderUpdated.data, NotFoundProducts: NotFoundProducts } };
        } catch (error) {
            console.error("Error updating purchase order:", error);
            throw error;
        }
    },

    /**
     * Valida una lista de IDs de órdenes de compra
     * @async
     * @function validListId
     * @param {number[]} purchaseOrderIds - Array de IDs de órdenes de compra a validar
     * @returns {Promise<Object>} Respuesta con los IDs encontrados y no encontrados
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Object} returns.data - Resultados de la validación
     * @returns {number[]} returns.data.foundIds - IDs que fueron encontrados en Odoo
     * @returns {number[]} returns.data.notFoundIds - IDs que no fueron encontrados
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const result = await purchaseOrderService.validListId([1, 2, 3, 999]);
     * console.log('Encontrados:', result.data.foundIds); // [1, 2, 3]
     * console.log('No encontrados:', result.data.notFoundIds); // [999]
     */
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
     * Actualiza las líneas de una orden de compra usando comandos específicos
     * @async
     * @function updatePurchaseOrderLines
     * @param {number|string} id - ID de la orden de compra
     * @param {number} action - Acción a realizar:
     *   - 1: Actualizar líneas existentes
     *   - 2: Eliminar líneas específicas
     *   - 3: Desconectar líneas (mantiene en BD pero desvincula)
     *   - 5: Eliminar todas las líneas
     *   - 6: Reemplazar todas las líneas con las especificadas
     * @param {Array} lines - Array de líneas o IDs según la acción:
     *   - Para acción 1: Array de objetos con datos de líneas
     *   - Para acciones 2,3: Array de IDs de líneas
     *   - Para acción 5: No se usa
     *   - Para acción 6: Array de IDs de líneas existentes
     * @returns {Promise<Object>} Respuesta con el resultado de la operación
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {*} returns.data - Datos de respuesta de Odoo
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * // Eliminar líneas específicas
     * await purchaseOrderService.updatePurchaseOrderLines(123, 2, [15, 16]);
     * 
     * // Eliminar todas las líneas
     * await purchaseOrderService.updatePurchaseOrderLines(123, 5, []);
     * 
     * // Actualizar líneas existentes
     * const linesToUpdate = [
     *   { product_id: 22, product_qty: 5, price_unit: 100 }
     * ];
     * await purchaseOrderService.updatePurchaseOrderLines(123, 1, linesToUpdate);
     */
    async updatePurchaseOrderLines(id, action, lines) {
        try {
            //verificamos que la orden de compra exista
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }
            //validamos la acción a realizar
            const validActions = [1, 2, 3, 5, 6];
            if (!validActions.includes(action)) {
                return { statusCode: 400, message: 'Acción no válida. Use 2 (eliminar), 3 (desconectar), 5 (eliminar todas), o 6 (reemplazar).' };
            }

            let lineCommands = [];
            //verificamos que si la accion requiere lineas, de ids, o de información, estas existan
            if (action === 2 || action === 3) {
                if (!lines || !Array.isArray(lines) || lines.length === 0) {
                    return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de líneas para las acciones 2 o 3.' };
                }
            }
            console.log('Updating purchase order lines with action:', action, 'and lines:', lines);

            //construimos la accion a realizar, pasandole las variables correspondientes a cada accion
            let actions = [action, ...lines];
            if (action === 5) {
                //accion 5 (eliminar todas las lineas) no requiere mas parametros
                actions = [action];
            } else if (action === 2) {
                //creamos un array con la accion 2 (eliminar) y el id de la linea que vamos a eliminar
                actions = lines.map((line) => { return [2, line] });
            } else if (action === 1) {
                //creamos un array con la accion 1 (actualizar), el id de la linea que vamos a actualizar y la informacion con la que vamos a actualizarla
                actions = lines.map((line, index) => { return [1, purchaseOrderExists.data.order_line[Number(index)], line] });
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

    /**
     * Verifica y actualiza las líneas de una orden de compra
     * Valida que el número de líneas proporcionadas coincida con las existentes
     * @async
     * @function verifyAndUpdatePurchaseOrderLines
     * @param {number|string} id - ID de la orden de compra
     * @param {Array<Object>} [lines=[]] - Array de líneas a verificar y actualizar
     * @param {number} [lines[].id] - ID de la línea (opcional)
     * @param {number} lines[].product_id - ID del producto
     * @param {number} [lines[].product_qty] - Cantidad del producto
     * @param {number} [lines[].price_unit] - Precio unitario
     * @returns {Promise<Object>} Respuesta con el resultado de la verificación y actualización
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {*} returns.data - Datos de respuesta
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const linesToVerify = [
     *   { product_id: 22, product_qty: 5, price_unit: 100 },
     *   { product_id: 23, product_qty: 2, price_unit: 200 }
     * ];
     * const result = await purchaseOrderService.verifyAndUpdatePurchaseOrderLines(123, linesToVerify);
     */
    async verifyAndUpdatePurchaseOrderLines(id, lines = []) {
        try {
            //verificamos que la orden de compra exista
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }

            //verificamos que la lista de lineas a verificar correspondan en size
            if ((!lines || lines.length === 0) || lines.length !== purchaseOrderExists.data.order_line.length) {
                return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de líneas para verificar y actualizar.' };
            }
            //envio el id, la acción 1 (actualizar) y la informacion con la que voy a actualizar las lineas
            const response = await this.updatePurchaseOrderLines(id, 1, lines);

            //verifico la respuesta de la actualización
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
    /**
     * Confirma una orden de compra (cambia estado a confirmado)
     * @async
     * @function confirmPurchaseOrder
     * @param {number|string} id - ID de la orden de compra a confirmar
     * @returns {Promise<Object>} Respuesta con el resultado de la confirmación
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 404, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {*} returns.data - Datos de respuesta de Odoo
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const result = await purchaseOrderService.confirmPurchaseOrder(123);
     * if (result.statusCode === 200) {
     *   console.log('Orden confirmada exitosamente');
     * }
     */
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
    /**
     * Crea una factura (bill) a partir de una o más órdenes de compra
     * @async
     * @function createBillFromPurchaseOrder
     * @param {number[]} purchaseOrderId - Array de IDs de órdenes de compra
     * @returns {Promise<Object>} Respuesta con la factura creada
     * @returns {number} returns.statusCode - Código de estado HTTP (201, 400, 404, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Object} returns.data - Datos de la factura creada
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const result = await purchaseOrderService.createBillFromPurchaseOrder([123, 124]);
     * if (result.statusCode === 201) {
     *   console.log('Factura creada:', result.data);
     * }
     */
    async createBillFromPurchaseOrder(purchaseOrderId) {
        try {
            //Compruebo la lista de ids de ordenes de venta a procesar
            if (!purchaseOrderId || !Array.isArray(purchaseOrderId) || purchaseOrderId.length === 0) {
                return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de ordenes de compra para crear facturas.' };
            }
            const idArray = purchaseOrderId.map((id) => { return Number(id) });

            //Valido la lista de las ordenes a facturar
            const purchaseOrderExists = await this.validListId(idArray);
            if (purchaseOrderExists.statusCode !== 200) {
                return { statusCode: purchaseOrderExists.statusCode, message: purchaseOrderExists.message, data: purchaseOrderExists.data };
            }

            const idsFound = purchaseOrderExists.data.foundIds.map((id) => { return Number(id) });
            if (idsFound.length === 0) {
                return { statusCode: 404, message: 'Ninguna de las ordenes de compra proporcionadas fue encontrada.', data: [] };
            }
            

            //Creo las facturas en Odoo a partir de las ordenes de compra encontradas
            const newBill = await odooConector.executeOdooRequest('purchase.order', 'action_create_invoice', {
                ids: idsFound
            });

            if (!newBill.success) {
                if (newBill.error) {
                    return { statusCode: 500, message: 'Error al crear factura desde orden de compra', error: newBill.message };
                }
                return { statusCode: newBill.statusCode, message: newBill.message, data: newBill.data };
            }

            const bill = await billService.getOneBill(newBill.data.res_id);

            return { statusCode: 201, message: 'Factura creada con éxito', data: bill.data };

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
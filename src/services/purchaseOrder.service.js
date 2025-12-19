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
     * Confirmar una orden de compra buscando por External ID.
     *
     * @async
     * @param {string} externalId - External ID de la orden de compra a confirmar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     *  - 200: Orden confirmada exitosamente.
     *  - 404: Orden no encontrada con el External ID.
     *  - 400/500: Error en validación o confirmación.
     *
     * @example
     * const res = await purchaseOrderService.confirmPurchaseOrderByExternalId('po_14_123456');
     * if (res.statusCode === 200) console.log('Orden confirmada');
     */
    async confirmPurchaseOrderByExternalId(externalId) {
        try {
            // Validar que el parámetro no esté vacío
            if (!externalId) {
                return {
                    statusCode: 400,
                    message: "El External ID de la orden de compra es requerido",
                    data: null
                };
            }

            // Buscar la orden de compra por External ID
            const poExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', String(externalId)], ['model', '=', 'purchase.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });

            if (!poExternalSearch.success || poExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una orden de compra con External ID: ${externalId}`,
                    data: null
                };
            }

            const purchaseOrderId = poExternalSearch.data[0].res_id;
            console.log("Orden de compra encontrada por External ID:", purchaseOrderId);

            // Reutilizar confirmPurchaseOrder con el ID interno
            const confirmResult = await this.confirmPurchaseOrder(purchaseOrderId);

            // Si hubo error, retornar sin formatear
            if (confirmResult.statusCode !== 200) {
                return confirmResult;
            }

            // Formatear la respuesta incluyendo el External ID
            return {
                statusCode: 200,
                message: "Orden de compra confirmada exitosamente por External ID",
                data: {
                    externalId: externalId,
                    purchaseOrderId: purchaseOrderId,
                    result: confirmResult.data
                }
            };

        } catch (error) {
            console.log("Error en purchaseOrderService.confirmPurchaseOrderByExternalId:", error);
            return {
                statusCode: 500,
                message: "Error al confirmar orden de compra por External ID",
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
    },

    /**
     * Cancelar una orden de compra por su ID.
     *
     * @async
     * @param {number|string} id - ID de la orden de compra a cancelar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     *  - 200: Orden cancelada exitosamente.
     *  - 404: Orden no encontrada.
     *  - 400/500: Error en validación o cancelación.
     */
    async cancelPurchaseOrder(id) {
        try {
            //Verificar que la orden de compra exista
            const poExists = await this.getPurchaseOrderById(id);
            if (poExists.statusCode !== 200) {
                return {
                    statusCode: poExists.statusCode,
                    message: poExists.message,
                    data: poExists.data,
                };
            }

            //Cancelar la orden de compra
            const response = await odooConector.executeOdooRequest(
                "purchase.order",
                "button_cancel",
                {
                    ids: [Number(id)],
                }
            );

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al cancelar orden de compra",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al cancelar orden de compra",
                    data: response.data,
                };
            }

            //Regreso la respuesta de la consulta
            return {
                statusCode: 200,
                message: "Orden de compra cancelada con éxito",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en purchaseOrderService.cancelPurchaseOrder:", error);
            return {
                statusCode: 500,
                message: "Error al cancelar orden de compra",
                error: error.message,
            };
        }
    },

    /**
     * Cancelar una orden de compra buscando por External ID.
     *
     * @async
     * @param {string} externalId - External ID de la orden de compra a cancelar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     *  - 200: Orden cancelada exitosamente.
     *  - 404: Orden no encontrada con el External ID.
     *  - 400/500: Error en validación o cancelación.
     *
     * @example
     * const res = await purchaseOrderService.cancelPurchaseOrderByExternalId('po_14_123456');
     * if (res.statusCode === 200) console.log('Orden cancelada');
     */
    async cancelPurchaseOrderByExternalId(externalId) {
        try {
            // Validar que el parámetro no esté vacío
            if (!externalId) {
                return {
                    statusCode: 400,
                    message: "El External ID de la orden de compra es requerido",
                    data: null
                };
            }

            // Buscar la orden de compra por External ID
            const poExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', String(externalId)], ['model', '=', 'purchase.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });

            if (!poExternalSearch.success || poExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una orden de compra con External ID: ${externalId}`,
                    data: null
                };
            }

            const purchaseOrderId = poExternalSearch.data[0].res_id;
            console.log("Orden de compra encontrada por External ID:", purchaseOrderId);

            // Reutilizar cancelPurchaseOrder con el ID interno
            const cancelResult = await this.cancelPurchaseOrder(purchaseOrderId);

            // Si hubo error, retornar sin formatear
            if (cancelResult.statusCode !== 200) {
                return cancelResult;
            }

            // Formatear la respuesta incluyendo el External ID
            return {
                statusCode: 200,
                message: "Orden de compra cancelada exitosamente por External ID",
                data: {
                    externalId: externalId,
                    purchaseOrderId: purchaseOrderId,
                    result: cancelResult.data
                }
            };

        } catch (error) {
            console.log("Error en purchaseOrderService.cancelPurchaseOrderByExternalId:", error);
            return {
                statusCode: 500,
                message: "Error al cancelar orden de compra por External ID",
                error: error.message
            };
        }
    },

    /**
     * Resetear una orden de compra a borrador por su ID.
     *
     * @async
     * @param {number|string} id - ID de la orden de compra a resetear.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     *  - 200: Orden reestablecida a borrador exitosamente.
     *  - 404: Orden no encontrada.
     *  - 400/500: Error en validación o reset.
     */
    async resetToDraftPurchaseOrder(id) {
        try {
            //Verificar que la orden de compra exista
            const poExists = await this.getPurchaseOrderById(id);
            if (poExists.statusCode !== 200) {
                return {
                    statusCode: poExists.statusCode,
                    message: poExists.message,
                    data: poExists.data,
                };
            }

            //Resetear la orden de compra a borrador
            const response = await odooConector.executeOdooRequest(
                "purchase.order",
                "button_draft",
                {
                    ids: [Number(id)],
                }
            );

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al resetear orden de compra a borrador",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al resetear orden de compra a borrador",
                    data: response.data,
                };
            }

            //Regreso la respuesta de la consulta
            return {
                statusCode: 200,
                message: "Orden de compra reestablecida a borrador con éxito",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en purchaseOrderService.resetToDraftPurchaseOrder:", error);
            return {
                statusCode: 500,
                message: "Error al resetear orden de compra a borrador",
                error: error.message,
            };
        }
    },

    /**
     * Resetear una orden de compra a borrador buscando por External ID.
     *
     * @async
     * @param {string} externalId - External ID de la orden de compra a resetear.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     *  - 200: Orden reestablecida a borrador exitosamente.
     *  - 404: Orden no encontrada con el External ID.
     *  - 400/500: Error en validación o reset.
     *
     * @example
     * const res = await purchaseOrderService.resetToDraftPurchaseOrderByExternalId('po_14_123456');
     * if (res.statusCode === 200) console.log('Orden reestablecida a borrador');
     */
    async resetToDraftPurchaseOrderByExternalId(externalId) {
        try {
            // Validar que el parámetro no esté vacío
            if (!externalId) {
                return {
                    statusCode: 400,
                    message: "El External ID de la orden de compra es requerido",
                    data: null
                };
            }

            // Buscar la orden de compra por External ID
            const poExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', String(externalId)], ['model', '=', 'purchase.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });

            if (!poExternalSearch.success || poExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una orden de compra con External ID: ${externalId}`,
                    data: null
                };
            }

            const purchaseOrderId = poExternalSearch.data[0].res_id;
            console.log("Orden de compra encontrada por External ID:", purchaseOrderId);

            // Reutilizar resetToDraftPurchaseOrder con el ID interno
            const resetResult = await this.resetToDraftPurchaseOrder(purchaseOrderId);

            // Si hubo error, retornar sin formatear
            if (resetResult.statusCode !== 200) {
                return resetResult;
            }

            // Formatear la respuesta incluyendo el External ID
            return {
                statusCode: 200,
                message: "Orden de compra reestablecida a borrador exitosamente por External ID",
                data: {
                    externalId: externalId,
                    purchaseOrderId: purchaseOrderId,
                    result: resetResult.data
                }
            };

        } catch (error) {
            console.log("Error en purchaseOrderService.resetToDraftPurchaseOrderByExternalId:", error);
            return {
                statusCode: 500,
                message: "Error al resetear orden de compra a borrador por External ID",
                error: error.message
            };
        }
    },

    /**
     * Actualiza líneas de una orden de compra desde un payload estructurado
     * Procesa un array de líneas con formato: {product_id, cantidad, unidad, preciounitario}
     * Ordena las líneas según su número de secuencia
     * @async
     * @function updatePurchaseOrderLinesFromPayload
     * @param {number|string} id - ID de la orden de compra
     * @param {Array<Object>} orderLines - Array de líneas a procesar
     * @param {number} orderLines[].product_id - ID del producto
     * @param {number} orderLines[].cantidad - Cantidad del producto
     * @param {string} orderLines[].unidad - Unidad de medida
     * @param {number} orderLines[].preciounitario - Precio unitario
     * @returns {Promise<Object>} Respuesta con el resultado de la operación
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {*} returns.data - Datos de respuesta de Odoo
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const payload = {
     *   order_lines: [
     *     { product_id: 22, cantidad: 5, unidad: 'Unidad', preciounitario: 100 },
     *     { product_id: 23, cantidad: 2, unidad: 'Kg', preciounitario: 200 }
     *   ]
     * };
     * const result = await purchaseOrderService.updatePurchaseOrderLinesFromPayload(123, payload.order_lines);
     */
    async updatePurchaseOrderLinesFromPayload(id, orderLines = []) {
        try {
            // Validar que la orden de compra exista
            const purchaseOrderExists = await this.getPurchaseOrderById(id);
            if (purchaseOrderExists.statusCode !== 200) {
                return { 
                    statusCode: purchaseOrderExists.statusCode, 
                    message: purchaseOrderExists.message, 
                    data: purchaseOrderExists.data 
                };
            }

            // Validar que se proporcionen líneas
            if (!orderLines || !Array.isArray(orderLines) || orderLines.length === 0) {
                return { 
                    statusCode: 400, 
                    message: 'Debe proporcionar un array de order_lines para actualizar' 
                };
            }

            // Transformar las líneas del formato recibido al formato de Odoo
            const transformedLines = orderLines.map((line, index) => {
                // Validar que cada línea tenga los campos requeridos
                if (!line.product_id || line.cantidad === undefined || line.preciounitario === undefined) {
                    throw new Error(`Línea ${index + 1}: Faltan campos requeridos (product_id, cantidad, preciounitario)`);
                }

                return {
                    product_id: Number(line.product_id),
                    product_qty: Number(line.cantidad),
                    name: line.name,
                    x_studio_n_remesa: line.x_studio_n_remesa,
                    price_unit: Number(line.preciounitario),
                    date_planned: line.date_planned,
                    action: line.action // Puede ser 'UPDATE', 'DELETE', o undefined
                };
            });


            // Obtener las líneas actuales de la orden de compra
            const linesResult = await this.getLinesByPurchaseOrderId(id, 'full');

            if (linesResult.statusCode !== 200) {
                return { 
                    statusCode: linesResult.statusCode,
                    message: linesResult.message,
                    data: linesResult.data
                };
            }   


            // Agrupar líneas por acción: actualizar, eliminar, crear
            const linesToUpdate = [];
            const linesToDelete = [];
            const linesToCreate = [];
            let lineIndex = 0;

            // Procesar cada línea transformada
            transformedLines.forEach((transformedLine) => {
                // Buscar la línea correspondiente en la orden actual
                const existingLine = linesResult.data.find(
                    line => line.x_studio_n_remesa === transformedLine.x_studio_n_remesa
                );
                console.log(`Procesando línea con x_studio_n_remesa: ${transformedLine.x_studio_n_remesa}`);
                console.log(existingLine)
                if (existingLine) {
                    // La línea existe
                    if (transformedLine.action === 'DELETE' && existingLine != null) {
                        // Marcar para eliminación
                        linesToDelete.push(existingLine.id);
                        console.log(`Línea ${transformedLine.x_studio_n_remesa} marcada para eliminación (ID: ${existingLine.id})`);
                    }
                    else if (transformedLine.action === 'UPDATE' && existingLine != null) {
                        // Actualizar línea existente (action UPDATE o undefined)
                        const updatedLineData = {
                            //id: existingLine ? existingLine.id : undefined,
                            product_id: transformedLine.product_id,
                            product_qty: transformedLine.product_qty,
                            price_unit: transformedLine.price_unit
                        };

                        if (transformedLine.date_planned) {
                            updatedLineData.date_planned = transformedLine.date_planned;
                        }

                        linesToUpdate.push({
                            id: existingLine.id,
                            lineIndex: lineIndex,
                            data: updatedLineData
                        });
                        console.log(`Línea ${transformedLine.x_studio_n_remesa} marcada para actualización (ID: ${existingLine.id})`);

                    }
                    lineIndex++;
                }
                if (transformedLine.action === 'CREATE') {

                    // Línea nueva (no existe en la orden actual)
                    const newLineData = {
                        product_id: transformedLine.product_id,
                        product_qty: transformedLine.product_qty,
                        price_unit: transformedLine.price_unit
                    };
                    if (transformedLine.date_planned) {
                        newLineData.date_planned = transformedLine.date_planned;
                    }
                    if (transformedLine.x_studio_n_remesa) {
                        newLineData.x_studio_n_remesa = transformedLine.x_studio_n_remesa;
                    }
                    linesToCreate.push(newLineData);
                    console.log(`Línea ${transformedLine.x_studio_n_remesa} será creada como nueva`);
                }
            });

            console.log('Líneas a crear:', linesToCreate);
            console.log('Líneas a actualizar:', linesToUpdate);
            console.log('Líneas a eliminar:', linesToDelete);

            // Ejecutar actualizaciones, eliminaciones y creaciones
            const updateResults = [];

            // 1. Eliminar líneas primero
            if (linesToDelete.length > 0) {
                console.log('Eliminando líneas:', linesToDelete);
                const deleteResponse = await this.updatePurchaseOrderLines(id, 2, linesToDelete);
                if (deleteResponse.statusCode !== 200) {
                    return {
                        statusCode: deleteResponse.statusCode,
                        message: 'Error al eliminar líneas de orden de compra',
                        error: deleteResponse.error
                    };
                }
                updateResults.push({ action: 'DELETE', count: linesToDelete.length });
            }

            // 2. Actualizar líneas existentes
            if (linesToUpdate.length > 0) {
                console.log('Actualizando líneas...');
                
                const linesToUpdateData = linesToUpdate.map((lineData) => {
                    // Extraer id y data del objeto lineData
                    console.log(lineData);
                    const { id, data } = lineData;
                    return [1, id, data];
                });

                console.log('Actualizando líneas existentes...', linesToUpdateData);
                const updateResponse = await odooConector.executeOdooRequest("purchase.order", "write", {
                    ids: [Number(id)],
                    vals: {
                        order_line: linesToUpdateData
                    }
                });
                

                if (!updateResponse.success) {
                    return {
                        statusCode: updateResponse.statusCode || 500,
                        message: 'Error al actualizar líneas de orden de compra',
                        error: updateResponse.error || updateResponse.message
                    };
                }
                updateResults.push({ action: 'UPDATE', count: linesToUpdate.length });
            }

            // 3. Crear nuevas líneas
            if (linesToCreate.length > 0) {
                console.log('Creando nuevas líneas...');
                // Para crear nuevas líneas, usamos el comando 0 (create)
                const createCommands = linesToCreate.map(lineData => [0, 0, lineData]);
                console.log('Creando líneas nuevas...', createCommands);
                const createResponse = await odooConector.executeOdooRequest("purchase.order", "write", {
                    ids: [Number(id)],
                    vals: {
                        order_line: createCommands
                    }
                });

                if (!createResponse.success) {
                    return {
                        statusCode: createResponse.statusCode || 500,
                        message: 'Error al crear nuevas líneas de orden de compra',
                        error: createResponse.error || createResponse.message
                    };
                }
                updateResults.push({ action: 'CREATE', count: linesToCreate.length });
            }

            // Obtener la orden actualizada
            const updatedPurchaseOrder = await this.getPurchaseOrderById(id);

            return { 
                statusCode: 200, 
                message: 'Líneas de orden de compra actualizadas con éxito', 
                data: {
                    purchaseOrderId: id,
                    purchaseOrder: updatedPurchaseOrder.data,
                    linesProcessed: transformedLines.length,
                    updateResults: updateResults,
                    summary: {
                        created: linesToCreate.length,
                        updated: linesToUpdate.length,
                        deleted: linesToDelete.length,
                        total: transformedLines.length
                    }
                }
            };

        } catch (error) {
            console.error("Error en updatePurchaseOrderLinesFromPayload:", error);
            return {
                statusCode: 500,
                message: 'Error al actualizar líneas de orden de compra desde payload',
                error: error.message
            };
        }
    },

    /**
     * Actualiza líneas de una orden de compra desde un payload con External IDs
     * Resuelve los External IDs a IDs internos para la orden de compra y productos
     * @async
     * @function updatePurchaseOrderLinesFromPayloadByExternalIds
     * @param {string} purchaseOrderExternalId - External ID de la orden de compra
     * @param {Array<Object>} orderLines - Array de líneas a procesar
     * @param {string} orderLines[].product_external_id - External ID del producto (requerido)
     * @param {number} orderLines[].cantidad - Cantidad del producto
     * @param {number} orderLines[].preciounitario - Precio unitario
     * @param {string} [orderLines[].x_studio_n_remesa] - Número de remesa (campo custom)
     * @param {string} [orderLines[].date_planned] - Fecha planificada de entrega
     * @param {string} [orderLines[].action] - Acción: 'UPDATE', 'DELETE', o undefined para crear
     * @returns {Promise<Object>} Respuesta con el resultado de la operación
     * @returns {number} returns.statusCode - Código de estado HTTP (200, 400, 404, 500)
     * @returns {string} returns.message - Mensaje descriptivo
     * @returns {Object} returns.data - Datos de respuesta con orden actualizada
     * @returns {string} [returns.error] - Mensaje de error si ocurre
     * 
     * @example
     * const payload = {
     *   order_lines: [
     *     { 
     *       product_external_id: 'prod_001', 
     *       cantidad: 5, 
     *       preciounitario: 100000,
     *       x_studio_n_remesa: '19114',
     *       action: 'UPDATE'
     *     },
     *     { 
     *       product_external_id: 'prod_002', 
     *       cantidad: 3, 
     *       preciounitario: 50000,
     *       action: 'CREATE'
     *     }
     *   ]
     * };
     * const result = await purchaseOrderService.updatePurchaseOrderLinesFromPayloadByExternalIds(
     *   'po_external_123', 
     *   payload.order_lines
     * );
     */
    async updatePurchaseOrderLinesFromPayloadByExternalIds(purchaseOrderExternalId, orderLines = []) {
        try {
            // Validar que el External ID de la orden de compra esté presente
            if (!purchaseOrderExternalId) {
                return {
                    statusCode: 400,
                    message: 'El External ID de la orden de compra es requerido',
                    data: null
                };
            }

            // Buscar la orden de compra por External ID
            const poExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', String(purchaseOrderExternalId)], ['model', '=', 'purchase.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });
            console.log("Resultado de búsqueda de orden de compra por External ID:", poExternalSearch);
            if (!poExternalSearch.success || poExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una orden de compra con External ID: ${purchaseOrderExternalId}`,
                    data: null
                };
            }

            const purchaseOrderId = poExternalSearch.data[0].res_id;
            console.log("Orden de compra encontrada por External ID:", purchaseOrderId);

            // Validar que se proporcionen líneas
            if (!orderLines || !Array.isArray(orderLines) || orderLines.length === 0) {
                return { 
                    statusCode: 400, 
                    message: 'Debe proporcionar un array de order_lines para actualizar' 
                };
            }

            // Validar y resolver External IDs de productos
            const productExternalIds = orderLines
                .filter(line => line.product_external_id)
                .map(line => line.product_external_id);

            if (productExternalIds.length === 0) {
                return {
                    statusCode: 400,
                    message: 'Todas las líneas deben tener un product_external_id',
                    data: null
                };
            }

            // Buscar los productos por sus External IDs
            const productsExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [
                    ['name', 'in', productExternalIds],
                    ['model', '=', 'product.product'],
                    ['module', '=', '__custom__']
                ],
                fields: ['name', 'res_id']
            });

            if (!productsExternalSearch.success) {
                return {
                    statusCode: 500,
                    message: 'Error al buscar productos por External ID',
                    error: productsExternalSearch.message
                };
            }

            // Crear un mapa de External ID -> product_id interno
            const productIdMap = {};
            const notFoundProductExternalIds = [];

            productsExternalSearch.data.forEach(product => {
                productIdMap[product.name] = product.res_id;
            });

            // Verificar que todos los productos fueron encontrados
            const foundProductExternalIds = Object.keys(productIdMap);
            const missingProductIds = productExternalIds.filter(id => !foundProductExternalIds.includes(id));

            if (missingProductIds.length > 0) {
                return {
                    statusCode: 404,
                    message: `Los siguientes productos no fueron encontrados: ${missingProductIds.join(', ')}`,
                    data: {
                        notFoundProductExternalIds: missingProductIds,
                        purchaseOrderId: purchaseOrderId
                    }
                };
            }

            console.log("Productos encontrados por External ID:", productIdMap);

            // Transformar las líneas reemplazando product_external_id por product_id
            const transformedOrderLines = orderLines.map((line, index) => {
                if (!line.product_external_id) {
                    throw new Error(`Línea ${index + 1}: El product_external_id es requerido`);
                }

                const product_id = productIdMap[line.product_external_id];
                if (!product_id) {
                    throw new Error(`Línea ${index + 1}: Producto no encontrado para External ID: ${line.product_external_id}`);
                }

                return {
                    product_id: product_id,
                    cantidad: line.cantidad,
                    preciounitario: line.preciounitario,
                    name: line.name,
                    x_studio_n_remesa: line.x_studio_n_remesa,
                    x_studio_rad_rndc: line.x_studio_rad_rndc,
                    date_planned: line.date_planned,
                    action: line.action
                };
            });

            console.log("Líneas transformadas con product_id interno:", transformedOrderLines);

            // Llamar al método principal con los IDs internos
            const result = await this.updatePurchaseOrderLinesFromPayload(purchaseOrderId, transformedOrderLines);

            // Enriquecer la respuesta con los External IDs
            if (result.statusCode === 200) {
                result.data.purchaseOrderExternalId = purchaseOrderExternalId;
            }

            return result;

        } catch (error) {
            console.error("Error en updatePurchaseOrderLinesFromPayloadByExternalIds:", error);
            return {
                statusCode: 500,
                message: 'Error al actualizar líneas de orden de compra desde payload con External IDs',
                error: error.message
            };
        }
    },

    /**
     * Obtener líneas (purchase.order.line) de una orden de compra por su ID.
     *
     * @async
     * @param {number|string} id - ID de la orden de compra.
     * @param {string} [action='id'] - 'id' para retornar solo product_id como id arreglo de ids, 'full' para retornar toda la data de las líneas.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de líneas) o error.
     */
    async getLinesByPurchaseOrderId(id, action = 'id') {
        try {
            console.log("Obteniendo líneas para orden de compra ID:", id, "con acción:", action);
            //Verificar que la orden de compra exista
            const purchaseOrder = await this.getPurchaseOrderById(id);
            if (purchaseOrder.statusCode !== 200) {
                return purchaseOrder;
            }

            console.log("Orden de compra encontrada:", purchaseOrder);

            //Buscar las líneas de esa orden de compra
            const lines = await odooConector.executeOdooRequest('purchase.order.line', 'search_read', { domain: [['id', 'in', purchaseOrder.data.order_line]] });
            if (!lines.success) {
                if (lines.error) {
                    return { statusCode: 500, message: 'Error al obtener líneas de orden de compra', error: lines.message };
                }
                return { statusCode: 400, message: 'Error al obtener líneas de orden de compra', data: lines.data };
            }

            //Formateo las líneas para que el product_id sea solo el id y no un array con id y nombre
            if (action === 'id') {
                lines.data = lines.data.map(line => line.product_id = line.product_id[0]);
            }

            //Regreso las líneas obtenidas
            return { statusCode: 200, message: 'Líneas de orden de compra obtenidas con éxito', data: lines.data };
        } catch (error) {
            console.error("Error getting lines by purchase order ID:", error);
            return {
                statusCode: 500,
                message: 'Error al obtener líneas de orden de compra',
                error: error.message
            };
        }
    }
    


};
module.exports = purchaseOrderService;
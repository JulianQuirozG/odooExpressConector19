const {
    QUOTATION_FIELDS,
} = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const productService = require("./products.service");
const partnerService = require("./partner.service");

const quotationService = {
    /**
     * Obtener todas las cotizaciones (sale.order) desde Odoo.
     *
     * @async
     * @param {string[]} [quotationFields] - Campos a recuperar por cotización.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de cotizaciones) o error.
     */
    async getQuotation(quotationFields = ["name", "partner_id", "date_order", "validity_date",
        "amount_total", "state", "order_line", "procurement_group_id"], domain = []) {
        try {
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "search_read",
                {
                    fields: quotationFields,
                    domain: domain,
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al obtener cotizaciones",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al obtener cotizaciones",
                    data: response.data,
                };
            }
            return {
                statusCode: 200,
                message: "Lista de cotizaciones",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en billService.getBills:", error);
            return {
                statusCode: 500,
                message: "Error al obtener cotizaciones",
                error: error.message,
            };
        }
    },
    /**
     * Obtener una cotización por su ID.
     *
     * @async
     * @param {number|string} id - ID de la cotización (sale.order).
     * @param {Array} [domain=[]] - Dominio adicional para filtrar la búsqueda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle) o error.
     */
    async getOneQuotation(id, domain = []) {
        try {
            const domainFinal = [['id', '=', id], ...domain];
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "search_read",
                {
                    domain: domainFinal,
                    limit: 1,
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al obtener cotización",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al obtener cotización",
                    data: response.data,
                };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: "Cotización no encontrada" };
            }
            return {
                statusCode: 200,
                message: "Detalle de la cotización",
                data: response.data[0],
            };
        } catch (error) {
            console.log("Error en billService.getOneBill:", error);
            return {
                statusCode: 500,
                message: "Error al obtener cotización",
                error: error.message,
            };
        }
    },
    /**
     * Crear una cotización (sale.order) en Odoo.
     *
     * - Valida que el partner exista.
     * - Valida que los productos indicados existan.
     * - Construye las líneas con la sintaxis requerida por Odoo y crea la cotización.
     *
     * @async
     * @param {Object} dataQuotation - Objeto con los campos de la cotización (filtrado por QUOTATION_FIELDS).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (cotización creada) o error.
     */
    async createQuotation(dataQuotation) {
        try {
            console.log(dataQuotation, "Datos recibidos para crear la cotización - sin procesar");
            const data = pickFields(dataQuotation, QUOTATION_FIELDS);

            
            console.log(dataQuotation, "Datos recibidos para crear la cotización");

            // Buscar la compañía por External ID si viene company_id
            if (dataQuotation.company_id) {
                const companyExternalId = dataQuotation.company_id;
                const companySearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                    domain: [
                        ['name', '=', companyExternalId],
                        ['model', '=', 'res.company']
                    ],
                    fields: ['res_id'],
                    limit: 1
                });

                if (!companySearch.success || companySearch.data.length === 0) {
                    return {
                        statusCode: 404,
                        message: `No se encontró una compañía con External ID: ${companyExternalId}`,
                        error: "COMPANY_NOT_FOUND"
                    };
                }

                // Asignar el ID interno de Odoo al data
                data.company_id = companySearch.data[0].res_id;
            }
            console.log(data, "Datos procesados para crear la cotización");

            // Verificar que el partner exista, buscando por ID o por External ID
            let partnerResponse;

            if (data.partner_id) {
                // Si viene partner_id, buscar por ID
                partnerResponse = await partnerService.getOnePartner(data.partner_id);
            } else if (dataQuotation.external_partner_id) {
                // Si no viene partner_id pero sí externalPartnerId, buscar por External ID
                const externalId = dataQuotation.external_partner_id;
                partnerResponse = await partnerService.getPartnerByExternalId(externalId);

                if (partnerResponse.statusCode === 200) {
                    // Si lo encontramos por External ID, asignar el partner_id al data
                    data.partner_id = partnerResponse.data.id;
                }
            } else {
                // Si no viene ninguno de los dos, retornar error
                return {
                    statusCode: 400,
                    message: "Debe proporcionar partner_id o externalPartnerId para crear la cotización",
                    error: "MISSING_PARTNER_IDENTIFIER"
                };
            }

            if (partnerResponse.statusCode === 404) {
                return {
                    statusCode: partnerResponse.statusCode,
                    message: "No se puede crear la cotización porque el partner no existe",
                    error: partnerResponse.message,
                };
            }

            if (partnerResponse.statusCode !== 200) {
                return {
                    statusCode: partnerResponse.statusCode,
                    message: "Error al verificar el partner",
                    error: partnerResponse.message || partnerResponse.error,
                };
            }

            //Verifico que los productos existan
            // if (data.order_line && data.order_line.length > 0) {
            //     const productResponse = await productService.validListId(
            //         data.order_line.map((line) => Number(line.product_id))
            //     );

            //     data.order_line = data.order_line.filter((line) =>
            //         productResponse.data.foundIds.includes(Number(line.product_id))
            //     );

            //     if (productResponse.statusCode !== 200) {
            //         return {
            //             statusCode: productResponse.statusCode,
            //             message: "No se puede crear la cotización porque algunos productos no existen",
            //             error: productResponse.message,
            //         };
            //     }
            // }

            //preparo los datos de los productos
            data.order_line = data.order_line
                ? data.order_line.map((line) => {
                    return [0, 0, line];
                })
                : [];

            console.log("Datos para crear la cotización:");
            console.log(data);
            //Crear la cotización
            const quotation = await odooConector.executeOdooRequest(
                "sale.order",
                "create",
                {
                    vals_list: data,
                }
            );

            if (!quotation.success) {
                return {
                    statusCode: 400,
                    message: "Error al crear cotización",
                    data: quotation.data,
                };
            }
            if (quotation.error) {
                return {
                    statusCode: 500,
                    message: "Error al crear cotización",
                    error: quotation.message,
                };
            }

            //regresar la cotización creada
            const newQuotation = await this.getOneQuotation(quotation.data);
            if (newQuotation.statusCode !== 200) return newQuotation;
            return {
                statusCode: 201,
                message: "Cotización creada",
                data: newQuotation.data,
            };


        } catch (error) {
            console.log("Error al crear la cotización:", error);
            return {
                statusCode: 500,
                message: "Error al crear cotización",
                error: error.message,
            };
        }
    },

    /**
     * Confirmar (action_confirm) una cotización para convertirla en orden de venta.
     *
     * @async
     * @param {number|string} id - ID de la cotización a confirmar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (cotización confirmada) o error.
     */
    async confirmQuotation(id) {
        try {
            //verifico que la cotización exista
            const quotationResponse = await this.getOneQuotation(id, [['state', '=', 'draft']]);
            if (quotationResponse.statusCode !== 200) return quotationResponse;
            //confirmo la cotización
            const quotationConfirmed = await odooConector.executeOdooRequest(
                "sale.order",
                "action_confirm",
                { ids: [Number(id)] });
            if (quotationConfirmed.error) {
                return {
                    statusCode: 500,
                    message: "Error al confirmar cotización",
                    error: quotationConfirmed.message,
                };
            }
            if (!quotationConfirmed.success) {
                return {
                    statusCode: 400,
                    message: "Error al confirmar cotización",
                    data: quotationConfirmed.data,
                };
            }

            return {
                statusCode: 200,
                message: "Cotización confirmada",
                data: await this.getOneQuotation(id),
            };
        }
        catch (error) {
            console.log("Error al confirmar la cotización:", error);
            return {
                statusCode: 500,
                message: "Error al confirmar cotización",
                error: error.message,
            };
        }
    },

    /**
     * Confirmar (action_confirm) una cotización usando External ID.
     *
     * @async
     * @param {string} externalId - External ID de la cotización a confirmar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async confirmQuotationByExternalId(externalId) {
        try {
            if (!externalId) {
                return {
                    statusCode: 400,
                    message: 'El External ID de la cotización es requerido',
                    data: null
                };
            }

            // Buscar sale.order por External ID
            const soExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [
                    ['name', '=', String(externalId)],
                    ['model', '=', 'sale.order'],
                    ['module', '=', '__custom__']
                ],
                fields: ['res_id']
            });

            if (!soExternalSearch.success || soExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una cotización con External ID: ${externalId}`,
                    data: null
                };
            }

            const quotationId = soExternalSearch.data[0].res_id;

            // Reutilizar confirmQuotation con el ID interno
            const confirmResult = await this.confirmQuotation(quotationId);

            if (confirmResult.statusCode === 200) {
                return {
                    statusCode: 200,
                    message: 'Cotización confirmada con éxito usando External ID',
                    data: {
                        quotationId,
                        quotationExternalId: externalId,
                        confirmData: confirmResult.data
                    }
                };
            }

            return confirmResult;
        } catch (error) {
            console.error("Error en quotationService.confirmQuotationByExternalId:", error);
            return {
                statusCode: 500,
                message: "Error al confirmar cotización por External ID",
                error: error.message
            };
        }
    },

    /**
     * Obtener las órdenes de compra relacionadas a una orden de venta (sale.order).
     *
     * @async
     * @param {number|string} saleOrderId - ID de la orden de venta.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de órdenes de compra) o error.
     */
    async getPurchaseOrdersBySaleOrderId(saleOrderId) {
        try {
            //verifico que la orden de venta exista
            const quotationResponse = await this.getOneQuotation(saleOrderId);
            if (quotationResponse.statusCode !== 200) return quotationResponse;

            //obtengo las ordenes de compra relacionadas
            let purchaseOrdersIds = await odooConector.executeOdooRequest('sale.order', 'action_view_purchase_orders', { ids: [saleOrderId] });
            if (purchaseOrdersIds.error) {
                return {
                    statusCode: 500,
                    message: "Error al obtener órdenes de compra",
                    error: purchaseOrdersIds.message,
                };
            }
            if (!purchaseOrdersIds.success) {
                return {
                    statusCode: 400,
                    message: "Error al obtener órdenes de compra",
                    data: purchaseOrdersIds.data,
                };
            }
            purchaseOrdersIds = purchaseOrdersIds.data;

            console.log(purchaseOrdersIds, "Estos son los IDs de las ordenes de compra relacionadas");
            //Si solo tiene una orden de compra relacionada
            if (purchaseOrdersIds.res_id) purchaseOrdersIds = [purchaseOrdersIds.res_id];
            else purchaseOrdersIds = purchaseOrdersIds.domain[0][2];

            //Obtengo los datos de las ordenes de compra
            const purchaseOrders = await odooConector.executeOdooRequest('purchase.order', 'search_read', {
                domain: [['id', 'in', purchaseOrdersIds]],
                //fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line', ],
            });

            return { statusCode: 200, message: "Órdenes de compra relacionadas", data: purchaseOrders.data };


        } catch (error) {
            console.log("Error al obtener las órdenes de compra:", error);
            return {
                statusCode: 500,
                message: "Error al obtener órdenes de compra",
                error: error.message,
            };
        }
    },
    /**
     * Validar una lista de IDs de cotizaciones (sale.order) y devolver cuáles existen y cuáles no.
     *
     * @async
     * @param {number[]} ids - Array de IDs a validar.
     * @param {Array} [domain=[]] - Dominio adicional para filtrar la búsqueda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data { foundIds, notFoundIds } o error.
     */
    async validListId(ids, domain = []) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                return { statusCode: 400, message: 'Debe proporcionar un array de IDs válido', data: { foundIds: [], notFoundIds: [] } };
            }

            const response = await odooConector.executeOdooRequest('sale.order', 'read', {
                ids: ids,
            });

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al validar cotizaciones', error: response.message };
                }
                return { statusCode: 400, message: 'Error al validar cotizaciones', data: response.data };
            }

            const foundIds = Array.isArray(response.data) ? response.data.map(item => item.id) : [];
            const notFoundIds = ids.filter(id => !foundIds.includes(id));

            return { statusCode: 200, message: 'Validación de cotizaciones', data: { foundIds, notFoundIds } };
        } catch (error) {
            console.error('Error en quotationService.validListId:', error);
            return { statusCode: 500, message: 'Error al validar cotizaciones', error: error.message };
        }
    },

    /**
     * Actualiza las líneas de una cotización (sale.order) usando comandos Odoo.
     * Acciones soportadas:
     *  - 1: Actualizar líneas existentes
     *  - 2: Eliminar líneas por ID
     *  - 3: Desconectar líneas
     *  - 5: Eliminar todas las líneas
     *  - 6: Reemplazar todas las líneas
     *
     * @async
     * @param {number|string} id - ID de la cotización (sale.order)
     * @param {number} action - Código de acción Odoo (1,2,3,5,6)
     * @param {Array} lines - Datos o IDs según la acción
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error
     */
    async updateQuotationLines(id, action, lines) {
        try {
            const quotation = await this.getOneQuotation(id);
            if (quotation.statusCode !== 200) return quotation;

            const validActions = [1, 2, 3, 5, 6];
            if (!validActions.includes(action)) {
                return { statusCode: 400, message: 'Acción no válida. Use 1 (actualizar), 2 (eliminar), 3 (desconectar), 5 (eliminar todas), o 6 (reemplazar).' };
            }

            let actions = [action, ...lines];
            if (action === 5) {
                actions = [action];
            } else if (action === 2) {
                actions = Array.isArray(lines) ? lines.map((lineId) => [2, lineId]) : [];
            } else if (action === 1) {
                actions = Array.isArray(lines)
                    ? lines.map((line, index) => [1, quotation.data.order_line[Number(index)], line])
                    : [];
            }

            const response = await odooConector.executeOdooRequest('sale.order', 'write', {
                ids: [Number(id)],
                vals: { order_line: actions }
            });

            if (!response.success) {
                if (response.error) return { statusCode: 500, message: 'Error al actualizar líneas de cotización', error: response.message };
                return { statusCode: 400, message: 'Error al actualizar líneas de cotización', data: response.data };
            }

            return { statusCode: 200, message: 'Líneas de cotización actualizadas con éxito', data: response.data };
        } catch (error) {
            console.error('Error updating quotation lines:', error);
            return { statusCode: 500, message: 'Error al actualizar líneas de cotización', error: error.message };
        }
    },

    /**
     * Obtener líneas (sale.order.line) de una cotización por su ID.
     *
     * @async
     * @param {number|string} id - ID de la cotización.
     * @param {string} [action='id'] - 'id' para mapear product_id a su ID, 'full' para retornar la data completa.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de líneas) o error.
     */
    async getLinesByQuotationId(id, action = 'id') {
        try {
            const quotation = await this.getOneQuotation(id);
            if (quotation.statusCode !== 200) return quotation;

            const lines = await odooConector.executeOdooRequest('sale.order.line', 'search_read', {
                domain: [['id', 'in', quotation.data.order_line]]
            });

            if (!lines.success) {
                if (lines.error) return { statusCode: 500, message: 'Error al obtener líneas de cotización', error: lines.message };
                return { statusCode: 400, message: 'Error al obtener líneas de cotización', data: lines.data };
            }

            if (action === 'id') {
                lines.data = lines.data.map(line => (line.product_id = Array.isArray(line.product_id) ? line.product_id[0] : line.product_id));
            }

            return { statusCode: 200, message: 'Líneas de cotización obtenidas con éxito', data: lines.data };
        } catch (error) {
            console.error('Error getting lines by quotation ID:', error);
            return { statusCode: 500, message: 'Error al obtener líneas de cotización', error: error.message };
        }
    },

    /**
     * Actualiza líneas de una cotización desde un payload con External IDs
     * Resuelve los External IDs a IDs internos para la cotización y productos
     *
     * @async
     * @function updateQuotationLinesFromPayloadByExternalIds
     * @param {string} quotationExternalId - External ID de la cotización (sale.order)
     * @param {Array<Object>} orderLines - Array de líneas a procesar
     * @param {string} orderLines[].product_external_id - External ID del producto (requerido)
     * @param {number} orderLines[].cantidad - Cantidad del producto
     * @param {number} orderLines[].preciounitario - Precio unitario
     * @param {string} [orderLines[].name] - Descripción de la línea
     * @param {string} [orderLines[].x_studio_n_remesa] - Campo custom opcional para conciliación
     * @param {string} [orderLines[].action] - Acción: 'DELETE' para eliminar todas las líneas existentes; undefined para crear
     * @returns {Promise<Object>} Respuesta con el resultado de la operación
     */
    async updateQuotationLinesFromPayloadByExternalIds(quotationExternalId, orderLines = []) {
        try {
            if (!quotationExternalId) {
                return { statusCode: 400, message: 'El External ID de la cotización es requerido', data: null };
            }

            // Buscar sale.order por External ID
            const soExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', String(quotationExternalId)], ['model', '=', 'sale.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });

            if (!soExternalSearch.success || soExternalSearch.data.length === 0) {
                return { statusCode: 404, message: `No se encontró una cotización con External ID: ${quotationExternalId}`, data: null };
            }
            const quotationId = soExternalSearch.data[0].res_id;

            // Verificar que la cotización no esté confirmada
            const quotationData = await this.getOneQuotation(quotationId);
            if (quotationData.statusCode !== 200) {
                return quotationData;
            }

            // Solo permitir actualizar líneas si la cotización está en estado draft o sent
            const allowedStates = ['draft'];
            if (!allowedStates.includes(quotationData.data.state)) {
                return {
                    statusCode: 400,
                    message: `No se pueden actualizar las líneas de una cotización en estado '${quotationData.data.state}'. La cotización debe estar en estado 'draft' o 'sent'.`,
                    data: {
                        quotationId,
                        quotationExternalId,
                        currentState: quotationData.data.state,
                        allowedStates
                    }
                };
            }

            if (!orderLines || !Array.isArray(orderLines) || orderLines.length === 0) {
                return { statusCode: 400, message: 'Debe proporcionar un array de order_lines para actualizar' };
            }

            // Resolver productos por External ID
            const productExternalIds = orderLines.filter(l => l.product_external_id).map(l => l.product_external_id);
            if (productExternalIds.length === 0) {
                return { statusCode: 400, message: 'Todas las líneas deben tener un product_external_id', data: null };
            }

            const productsExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [[ 'name', 'in', productExternalIds ], [ 'model', '=', 'product.product' ], [ 'module', '=', '__custom__' ]],
                fields: ['name', 'res_id']
            });
            if (!productsExternalSearch.success) {
                return { statusCode: 500, message: 'Error al buscar productos por External ID', error: productsExternalSearch.message };
            }

            const productIdMap = {};
            productsExternalSearch.data.forEach(p => { productIdMap[p.name] = p.res_id; });
            const foundProductExternalIds = Object.keys(productIdMap);
            const missingProductIds = productExternalIds.filter(id => !foundProductExternalIds.includes(id));
            if (missingProductIds.length > 0) {
                return { statusCode: 404, message: `Los siguientes productos no fueron encontrados: ${missingProductIds.join(', ')}`, data: { notFoundProductExternalIds: missingProductIds, quotationId } };
            }

            // Transformar líneas
            const transformedLines = orderLines.map((line, index) => {
                const product_id = productIdMap[line.product_external_id];
                if (!product_id) throw new Error(`Línea ${index + 1}: Producto no encontrado para External ID: ${line.product_external_id}`);
                return {
                    product_id,
                    product_uom_qty: Number(line.cantidad),
                    price_unit: Number(line.preciounitario),
                    name: line.name,
                    x_studio_n_remesa: line.x_studio_n_remesa,
                    x_studio_rad_rndc: line.x_studio_rad_rndc,
                    action: line.action
                };
            });

            // Obtener líneas actuales
            const linesResult = await this.getLinesByQuotationId(quotationId, 'full');
            if (linesResult.statusCode !== 200) return linesResult;

            // Preparar acciones: eliminar todas si alguna línea pide DELETE, y crear el resto
            const linesToDelete = [];
            const linesToCreate = [];
            const linesToUpdate = [];
            let lineIndex = 0;

            // Procesar cada línea transformada
            transformedLines.forEach((transformedLine) => {
                const existingLine = linesResult.data.find(
                    line => line.x_studio_n_remesa === transformedLine.x_studio_n_remesa
                );
                if (transformedLine.action === 'DELETE') {
                    // Marcar para eliminación - eliminar todas las existentes

                    linesToDelete.push(existingLine.id);

                    console.log(`Línea marcada para eliminación`);
                } else {
                    // Crear nuevas líneas o actualizar
                    const newLineData = {
                        product_id: transformedLine.product_id,
                        quantity: transformedLine.quantity,
                        price_unit: transformedLine.price_unit
                    };

                    if (transformedLine.name) {
                        newLineData.name = transformedLine.name;
                    }

                    if (transformedLine.date_maturity) {
                        newLineData.date_maturity = transformedLine.date_maturity;
                    }

                    linesToCreate.push(newLineData);
                    console.log(`Línea será creada o actualizada`);
                }
            });

            const updateResults = [];
            // 1) Eliminar
            if (linesToDelete.length > 0) {
                const delResp = await this.updateQuotationLines(quotationId, 2, linesToDelete);
                if (delResp.statusCode !== 200) return { statusCode: delResp.statusCode, message: 'Error al eliminar líneas de cotización', error: delResp.error };
                updateResults.push({ action: 'DELETE', count: linesToDelete.length });
            }

            // 2) Crear
            if (linesToCreate.length > 0) {
                const createCommands = linesToCreate.map(d => [0, 0, d]);
                const createResp = await odooConector.executeOdooRequest('sale.order', 'write', {
                    ids: [Number(quotationId)],
                    vals: { order_line: createCommands }
                });
                if (!createResp.success) {
                    return { statusCode: createResp.statusCode || 500, message: 'Error al crear nuevas líneas de cotización', error: createResp.error || createResp.message };
                }
                updateResults.push({ action: 'CREATE', count: linesToCreate.length });
            }

            // Cotización actualizada
            const updatedQuotation = await this.getOneQuotation(quotationId);
            return {
                statusCode: 200,
                message: 'Líneas de cotización actualizadas con éxito',
                data: {
                    quotationId,
                    quotationExternalId,
                    quotation: updatedQuotation.data,
                    linesProcessed: transformedLines.length,
                    updateResults,
                    summary: {
                        created: linesToCreate.length,
                        deleted: linesToDelete.length,
                        total: transformedLines.length
                    }
                }
            };
        } catch (error) {
            console.error('Error en updateQuotationLinesFromPayloadByExternalIds:', error);
            return { statusCode: 500, message: 'Error al actualizar líneas de cotización desde payload con External IDs', error: error.message };
        }
    },

    /**
     * Cancelar una cotización (sale.order).
     *
     * @async
     * @param {number|string} id - ID de la cotización a cancelar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async cancelQuotation(id) {
        try {
            // Verificar que la cotización exista
            const quotationExists = await this.getOneQuotation(id);
            if (quotationExists.statusCode !== 200) {
                return {
                    statusCode: quotationExists.statusCode,
                    message: quotationExists.message,
                    data: quotationExists.data,
                };
            }

            // Cancelar la cotización
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "action_cancel",
                {
                    ids: [Number(id)],
                }
            );

            // Si hay algún error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al cancelar cotización",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al cancelar cotización",
                    data: response.data,
                };
            }

            return {
                statusCode: 200,
                message: "Cotización cancelada con éxito",
                data: response.data,
            };
        } catch (error) {
            console.error("Error en quotationService.cancelQuotation:", error);
            return {
                statusCode: 500,
                message: "Error al cancelar cotización",
                error: error.message,
            };
        }
    },

    /**
     * Cancelar una cotización (sale.order) usando External ID.
     *
     * @async
     * @param {string} externalId - External ID de la cotización a cancelar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async cancelQuotationByExternalId(externalId) {
        try {
            if (!externalId) {
                return {
                    statusCode: 400,
                    message: 'El External ID de la cotización es requerido',
                    data: null
                };
            }

            // Buscar sale.order por External ID
            const soExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [
                    ['name', '=', String(externalId)],
                    ['model', '=', 'sale.order'],
                    ['module', '=', '__custom__']
                ],
                fields: ['res_id']
            });

            if (!soExternalSearch.success || soExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una cotización con External ID: ${externalId}`,
                    data: null
                };
            }

            const quotationId = soExternalSearch.data[0].res_id;

            // Reutilizar cancelQuotation con el ID interno
            const cancelResult = await this.cancelQuotation(quotationId);

            if (cancelResult.statusCode === 200) {
                return {
                    statusCode: 200,
                    message: 'Cotización cancelada con éxito usando External ID',
                    data: {
                        quotationId,
                        quotationExternalId: externalId,
                        cancelData: cancelResult.data
                    }
                };
            }

            return cancelResult;
        } catch (error) {
            console.error("Error en quotationService.cancelQuotationByExternalId:", error);
            return {
                statusCode: 500,
                message: "Error al cancelar cotización por External ID",
                error: error.message
            };
        }
    },

    /**
     * Resetear una cotización (sale.order) a estado borrador.
     * Primero la cancela y luego la pasa a draft.
     *
     * @async
     * @param {number|string} id - ID de la cotización a resetear.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async resetToDraftQuotation(id) {
        try {
            // Verificar que la cotización exista
            const quotationExists = await this.getOneQuotation(id);
            if (quotationExists.statusCode !== 200) {
                return {
                    statusCode: quotationExists.statusCode,
                    message: quotationExists.message,
                    data: quotationExists.data,
                };
            }

            // Primero cancelar la cotización si no está en draft o cancel
            if (quotationExists.data.state !== 'draft' && quotationExists.data.state !== 'cancel') {
                const cancelResponse = await odooConector.executeOdooRequest(
                    "sale.order",
                    "action_cancel",
                    {
                        ids: [Number(id)],
                    }
                );

                if (!cancelResponse.success) {
                    if (cancelResponse.error) {
                        return {
                            statusCode: 500,
                            message: "Error al cancelar cotización antes de pasar a borrador",
                            error: cancelResponse.message,
                        };
                    }
                    return {
                        statusCode: 400,
                        message: "Error al cancelar cotización antes de pasar a borrador",
                        data: cancelResponse.data,
                    };
                }
            }

            // Ahora resetear la cotización a borrador
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "action_draft",
                {
                    ids: [Number(id)],
                }
            );

            // Si hay algún error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al resetear cotización a borrador",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al resetear cotización a borrador",
                    data: response.data,
                };
            }

            // Regreso la respuesta de la consulta
            return {
                statusCode: 200,
                message: "Cotización reestablecida a borrador con éxito",
                data: response.data,
            };
        } catch (error) {
            console.error("Error en quotationService.resetToDraftQuotation:", error);
            return {
                statusCode: 500,
                message: "Error al resetear cotización a borrador",
                error: error.message,
            };
        }
    },

    /**
     * Resetear una cotización (sale.order) a estado borrador usando External ID.
     *
     * @async
     * @param {string} externalId - External ID de la cotización a resetear.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async resetToDraftQuotationByExternalId(externalId) {
        try {
            if (!externalId) {
                return {
                    statusCode: 400,
                    message: 'El External ID de la cotización es requerido',
                    data: null
                };
            }

            // Buscar sale.order por External ID
            const soExternalSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [
                    ['name', '=', String(externalId)],
                    ['model', '=', 'sale.order'],
                    ['module', '=', '__custom__']
                ],
                fields: ['res_id']
            });

            if (!soExternalSearch.success || soExternalSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró una cotización con External ID: ${externalId}`,
                    data: null
                };
            }

            const quotationId = soExternalSearch.data[0].res_id;

            // Reutilizar resetToDraftQuotation con el ID interno
            const resetResult = await this.resetToDraftQuotation(quotationId);

            if (resetResult.statusCode === 200) {
                return {
                    statusCode: 200,
                    message: 'Cotización reestablecida a borrador con éxito usando External ID',
                    data: {
                        quotationId,
                        quotationExternalId: externalId,
                        resetData: resetResult.data
                    }
                };
            }

            return resetResult;
        } catch (error) {
            console.error("Error en quotationService.resetToDraftQuotationByExternalId:", error);
            return {
                statusCode: 500,
                message: "Error al resetear cotización a borrador por External ID",
                error: error.message
            };
        }
    },
};

module.exports = quotationService;

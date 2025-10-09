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
        "amount_total", "state", "order_line", "procurement_group_id"]) {
        try {
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "search_read",
                {
                    fields: quotationFields,
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
            const data = pickFields(dataQuotation, QUOTATION_FIELDS);
            //verifico que el partner exista
            const partnerResponse = await partnerService.getOnePartner(
                data.partner_id
            );
            if (partnerResponse.statusCode !== 200) {
                return {
                    statusCode: partnerResponse.statusCode,
                    message: "No se puede crear la cotización porque el partner no existe",
                    error: partnerResponse.message,
                };
            }

            //Verifico que los productos existan
            if (data.order_line && data.order_line.length > 0) {
                const productResponse = await productService.validListId(
                    data.order_line.map((line) => Number(line.product_id))
                );

                data.order_line = data.order_line.filter((line) =>
                    productResponse.data.foundIds.includes(Number(line.product_id))
                );

                if (productResponse.statusCode !== 200) {
                    return {
                        statusCode: productResponse.statusCode,
                        message: "No se puede crear la cotización porque algunos productos no existen",
                        error: productResponse.message,
                    };
                }
            }

            //preparo los datos de los productos
            data.order_line = data.order_line
                ? data.order_line.map((line) => {
                    return [0, 0, line];
                })
                : [];

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

            //Si solo tiene una orden de compra relacionada
            if (purchaseOrdersIds.res_id) purchaseOrdersIds = [purchaseOrdersIds.res_id];
            else purchaseOrdersIds.data = purchaseOrdersIds.data.domain[0][2];

            //Obtengo los datos de las ordenes de compra
            const purchaseOrders = await odooConector.executeOdooRequest('purchase.order', 'search_read', {
                domain: [['id', 'in', purchaseOrdersIds]],
                fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line'],
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
    }
};

module.exports = quotationService;

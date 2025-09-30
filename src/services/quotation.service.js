const { da } = require("zod/locales");
const {
    BILL_FIELDS,
    PRODUCT_FIELDS,
    PRODUCT_FIELDS_BILL,
    INVOICE_LINE_FIELDS,
    QUOTATION_FIELDS,
    QUOTATION_LINE_FIELDS
} = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const productService = require("./products.service");
const partnerService = require("./partner.service");

const quotationService = {
    //obtener todas las cotizaciones
    async getQuotation(quotationFields = ["name", "partner_id", "date_order", "validity_date",
        "amount_total", "state", "order_line"]) {
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
    //obtener una cotización por id
    async getOneQuotation(id, domain = []) {
        try {
            const domainFinal = [['id', '=', id], ...domain];
            const response = await odooConector.executeOdooRequest(
                "sale.order",
                "search_read",
                {
                    domain: domainFinal,
                    fields: ["name", "partner_id", "date_order", "validity_date", "amount_total", "state", "order_line"],
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
    //crear una cotización
    async createQuotation(dataQuotation) {
        try {

            //verifico que el partner exista
            const partnerResponse = await partnerService.getOnePartner(
                dataQuotation.partner_id
            );
            if (partnerResponse.statusCode !== 200) {
                return {
                    statusCode: partnerResponse.statusCode,
                    message: "No se puede crear la cotización porque el partner no existe",
                    error: partnerResponse.message,
                };
            }

            //Verifico que los productos existan
            console.log('Data quotation lines:',  dataQuotation.order_line.map((line) => Number(line.product_id)));
            if (dataQuotation.order_line && dataQuotation.order_line.length > 0) {
                const productResponse = await productService.validListId(
                    dataQuotation.order_line.map((line) => Number(line.product_id))
                );

                console.log('Productos encontrados:', productResponse);
                dataQuotation.order_line = dataQuotation.order_line.filter((line) =>
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
            dataQuotation.order_line = dataQuotation.order_line
                ? dataQuotation.order_line.map((line) => {
                    return [0, 0, line];
                })
                : [];

            //Crear la cotización
            const quotation = await odooConector.executeOdooRequest(
                "sale.order",
                "create",
                {
                    vals_list: dataQuotation,
                }
            );

            if (!quotation.success) {return {
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
            return this.getOneQuotation(quotation.data);


        } catch (error) {
            console.log("Error al crear la cotización:", error);
            return {
                statusCode: 500,
                message: "Error al crear cotización",
                error: error.message,
            };
        }
    }
};

module.exports = quotationService;

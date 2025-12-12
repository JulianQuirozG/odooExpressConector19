const salesFields = ["name", "partner_id", "date_order", "amount_total", "state", "name"];
const odooConector = require("../utils/odoo.service");

//Services
const quotationService = require("./quotation.service");
const purchaseOrderService = require("./purchaseOrder.service");
const billService = require("./bills.service");
const { ca, id } = require("zod/locales");
const partnerService = require("./partner.service");
const productService = require("./products.service");
const e = require("express");

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
                data: response.data[0]
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

    async createBillFromSalesOrder(salesOrderIds) {
        try {
            // Validar los IDs de las órdenes de venta
            if (!salesOrderIds || salesOrderIds.length === 0) {
                return { statusCode: 400, message: 'IDs de órdenes de venta inválidos', data: [] };
            }

            // Resolver IDs (pueden ser IDs normales o External IDs)
            const resolvedIds = [];
            for (const orderId of salesOrderIds) {
                let saleOrderId = orderId;

                // Si no es numérico, intentar buscar por External ID
                if (isNaN(Number(orderId))) {
                    console.log('Buscando orden de venta por External ID:', orderId);
                    const externalIdSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                        domain: [['name', '=', orderId], ['model', '=', 'sale.order'], ['module', '=', '__custom__']],
                        fields: ['res_id']
                    });

                    console.log(externalIdSearch, "Resultado de la búsqueda por External ID");
                    if (externalIdSearch.success && externalIdSearch.data.length > 0) {
                        saleOrderId = externalIdSearch.data[0].res_id;
                    } else {
                        return {
                            statusCode: 404,
                            message: `No se encontró una orden de venta con External ID: ${orderId}`,
                            data: null
                        };
                    }
                } else {
                    saleOrderId = Number(orderId);
                }

                resolvedIds.push(saleOrderId);
            }

            // Verifico que las ordenes de venta existan
            const getSaleOrders = await quotationService.getQuotation(['id'], [['invoice_status', '=', 'to invoice'], ['id', 'in', resolvedIds]]); //filtro por los ids que me envian
            if (getSaleOrders.statusCode !== 200) return getSaleOrders;
            if (getSaleOrders.data.length != resolvedIds.length) return { statusCode: 404, message: `Órdenes de venta no encontradas: ${resolvedIds.filter(id => !getSaleOrders.data.map(order => order.id).includes(id)).join(', ')}` };

            //mapear los ids a numeros
            const ids = resolvedIds.map(id => [4, Number(id)]);

            //ejecuto el wizard para traer toda la info y crear la factura
            const wizardCreate = await odooConector.executeOdooRequest('sale.advance.payment.inv', 'create', {
                vals_list: [{
                    sale_order_ids: ids,
                    advance_payment_method: 'delivered',
                    consolidated_billing: 'true',
                }],
                context: { active_model: 'sale.order', active_ids: ids, active_id: ids[0] }
            });

            if (!wizardCreate.success) {
                return { statusCode: 500, message: 'Error creando wizard facturación', error: wizardCreate.data };
            }

            const wizardId = wizardCreate.data[0];

            //creo la factura
            const response = await odooConector.executeOdooRequest(
                "sale.advance.payment.inv",
                "create_invoices",
                {
                    ids: wizardId,
                    context: {
                        active_model: 'sale.order',
                        active_ids: ids,
                        active_id: ids[0]
                    }
                }
            );

            if (response.error) return { statusCode: 500, message: 'Error al crear factura desde orden de venta', error: response.message };
            if (!response.success) return { statusCode: 400, message: 'Error al crear factura desde orden de venta', data: response.data };
            const invoices = response.data.res_id == 0 ? response.data.domain[0][2] : [response.data.res_id];

            //Por cada factura creada, la actualizo con el detalle de las lineas de sus ordenes de venta e informacion de pago
            for (const invoice of invoices) {
                //obtenemos las ordenes de venta relacionadas a esa factura
                const saleOrders = await billService.getSaleOrdersByBillId(invoice);

                //obtenemos las lineas de esas ordenes de venta
                const invoiceLines = [];
                for (const saleOrder of saleOrders.data) {
                    const lines = await odooConector.executeOdooRequest('sale.order.line', 'search_read', { domain: [['order_id', '=', saleOrder.id]] });
                    if (!lines.success) {
                        if (lines.error) {
                            return { statusCode: 500, message: 'Error al obtener líneas de orden de compra', error: lines.message };
                        }
                        return { statusCode: 400, message: 'Error al obtener líneas de orden de compra', data: lines.data };
                    }
                    //Agregamos las lineas de la orden de ventas a las de la factura
                    for (const line of lines.data) {
                        line.product_id = line.product_id[0];
                        invoiceLines.push(line);
                    }
                }

                //Actualizo la factura con las lineas obtenidas y el tipo de operacion
                await billService.updateBill(invoice, { invoice_line_ids: invoiceLines, l10n_co_edi_operation_type: "12", l10n_co_edi_payment_option_id: 66 }, 'update');
                
                //Confirmo la factura y envio a la DIAN 
                await billService.confirmCreditNote(invoice);
            }

            return {
                statusCode: 201,
                message: 'Factura(s) creada(s) desde la(s) orden(es) de venta',
                data: invoices
            };


        } catch (error) {
            console.error('Error al crear factura desde orden de venta en Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al crear factura desde orden de venta',
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

            //recorremos cada venta a crear
            const sales = [];
            for (const sale of data.sales) {
                try {
                    const { dataVenta, dataCompra } = sale;
                    const external_solicitud_transportista = dataVenta.external_solicitud_transportista || null;
                    const externalCompanyId = dataVenta.externalCompanyId || null;

                    if (!external_solicitud_transportista || !externalCompanyId) {
                        return {
                            statusCode: 400,
                            message: 'Error al crear factura desde orden de compra',
                            error: 'Faltan los campos external_solicitud_transportista o external_empresa en dataVenta'
                        };
                    }

                    delete dataVenta.external_solicitud_transportista;
                    delete dataVenta.externalCompanyId;

                    //crear cotizacion
                    const quotation = await quotationService.createQuotation(dataVenta);
                    if (quotation.statusCode !== 201) return quotation;

                    console.log(quotation.data.id, "Este es el ID de la cotización creada");

                    //crear external ID para la cotizacion
                    const externalSalseOrderIdName = `sale_order_${externalCompanyId}_${external_solicitud_transportista}`;
                    const createExternalIdQuotation = await odooConector.createExternalId(externalSalseOrderIdName, 'sale.order', quotation.data.id);

                    if (!createExternalIdQuotation.success) {
                        console.error('Error al crear External ID para factura de compra:', createExternalIdQuotation.message);
                    }

                    //confirmar cotizacion 
                    const confirmQuotation = await quotationService.confirmQuotation(quotation.data.id);
                    if (confirmQuotation.statusCode !== 200) return confirmQuotation;

                    console.log(confirmQuotation.data, "Esta es la cotización confirmada");

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

                    //crear la factura de la orden de compra
                    const bill = await purchaseOrderService.createBillFromPurchaseOrder([purchaseOrderId]);
                    if (bill.statusCode !== 201) return bill;

                    //Crear External ID para la factura de compra
                    const externalPurchaseIdName = `purchase_invoice_${externalCompanyId}_${external_solicitud_transportista}`;
                    const createExternalId = await odooConector.createExternalId(externalPurchaseIdName, 'account.move', bill.data.id);

                    if (!createExternalId.success) {
                        console.error('Error al crear External ID para factura de compra:', createExternalId.message);
                    }

                    //Actualizamos la factura de compra validando los campos personalizados
                    const updatePurchaseBill = await billService.updateBill(bill.data.id, { invoice_line_ids: dataCompra.order_line }, 'update');
                    if (updatePurchaseBill.statusCode !== 200) return updatePurchaseBill;

                    //Confirmar factura de la orden de compra
                    const confirmBill = await billService.confirmBill(bill.data.id);
                    if (confirmBill.statusCode !== 200) return confirmBill;

                    sales.push({ saleOrder: quotation.data, purchaseOrder: updatePurchaseOrder.data });
                } catch (error) {
                    sales.push({ statusCode: 500, message: 'Error al crear la venta', error: error.message });
                }
            }


            // //Regresar la informacion de la orden de venta final con orden de compra
            // const sale = await this.getSaleById(quotation.data.id);
            // if (sale.statusCode !== 200) return sale;

            // //traer el detalle de la factura de compra
            // const billDetails = await billService.getOneBill(bill.data.id);
            // if (billDetails.statusCode !== 200) return billDetails;

            // //crear la factura de venta
            // const createBillFromSalesOrder = await this.createBillFromSalesOrder([quotation.data.id]);
            // if (createBillFromSalesOrder.statusCode !== 201) return createBillFromSalesOrder;

            // //actualizar la factura de venta con los campos personalizados
            // const updateSaleBill = await billService.updateBill(createBillFromSalesOrder.data.id, { l10n_co_edi_operation_type: dataVenta.l10n_co_edi_operation_type, l10n_co_edi_payment_option_id: dataVenta.l10n_co_edi_payment_option_id, invoice_line_ids: dataVenta.order_line }, 'update');
            // if (updateSaleBill.statusCode !== 200) return updateSaleBill;

            // //confirmar la factura de venta
            // const confirmSaleBill = await billService.confirmBill(createBillFromSalesOrder.data.id);
            // if (confirmSaleBill.statusCode !== 200) return confirmSaleBill;

            // //validar la factura de venta, nota credito o nota debito con la dian
            // const dianResponse = await billService.syncDian(createBillFromSalesOrder.data.id);
            // if (dianResponse.statusCode !== 200) return dianResponse;

            // const updateSaleBillCufe = await billService.updateBill(createBillFromSalesOrder.data.id, { l10n_co_edi_cufe_cude_ref: dianResponse.data.cufe, x_studio_uuid_dian: dianResponse.data.uuid_dian }, 'update');
            // if (updateSaleBillCufe.statusCode !== 200) return updateSaleBillCufe;

            // //Subimos los documentos a odoo
            // const files = await billService.uploadFilesFromDian(createBillFromSalesOrder.data.id, dianResponse.data);
            // if (files.statusCode !== 200) return files;

            // //regresar toda la informacion
            // const saleBillDetails = await billService.getOneBill(createBillFromSalesOrder.data.id);
            // if (saleBillDetails.statusCode !== 200) return saleBillDetails;

            return {
                statusCode: 201,
                data: {
                    sales
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

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

    updateSaleLines: async (data, quotationExternalId, purchaseOrderExternalId, purchaseBillExternalId) =>{
        try {
            console.log("datasasa: ",data)
            console.log("quotationExternalId: ",quotationExternalId)
            console.log("purchaseOrderExternalId: ",purchaseOrderExternalId)
            console.log("purchaseBillExternalId: ",purchaseBillExternalId)
            const saleOrder = {
                invoice_line_ids: data.order_lines
            };

            //consultar el id de la cotizacion por el id externo
            const quotation = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', quotationExternalId], ['model', '=', 'sale.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });

            const saleOrderLines = await quotationService.getLinesByQuotationId(quotation.data[0].res_id,'full');
            

            const quotationLinesToUpdateCreate = data.order_lines.map(line => {

                const lineExist = saleOrderLines.data.find(saleLine => saleLine.x_studio_n_remesa === line.x_studio_n_remesa);

                return {
                    ...line,
                    action: lineExist ? 'UPDATE' : 'CREATE',
                }
            })

            const quotationLinesToDelete = saleOrderLines.data.map(line => {

                const lineExist = data.order_lines.find(saleLine => saleLine.x_studio_n_remesa === line.x_studio_n_remesa);

                if (!lineExist) {
                    return {
                        product_external_id:"service_14_11001000",
                        x_studio_n_remesa: line.x_studio_n_remesa,
                        action: 'DELETE',
                    }
                }

            })

            const quotationNewLines = [
                ...quotationLinesToUpdateCreate,
                ...quotationLinesToDelete.filter(line => line !== undefined)
            ]

            console.log("data para cotizacion de venta",quotationNewLines)
            console.log("quotationExternalId",quotationExternalId)
            const quotationUpdate = await quotationService.updateQuotationLinesFromPayloadByExternalIds(quotationExternalId, quotationNewLines);

            if (quotationUpdate.statusCode !== 200) return quotationUpdate;

            //Ahora actualizaremos la orden de compra

            const saleOrderLinesUpdated = await quotationService.getLinesByQuotationId(quotation.data[0].res_id,'full');


            const purchaseNewLines = quotationNewLines.map(line => {

                const lineUpdated = saleOrderLinesUpdated.data.find(saleLine => saleLine.x_studio_n_remesa === line.x_studio_n_remesa);

                if( line.action === 'DELETE') return {...line};
                
                return {
                    ...line,
                    sale_order_id: quotation.data[0].res_id,
                    sale_line_id: lineUpdated ? lineUpdated.id : null,
                }
            })

            console.log("data para cotizacion de compra",purchaseNewLines)
            console.log("purchaseOrderExternalId",purchaseOrderExternalId)
            //Ahora utilizo el endpoint y actualizo las lineas de la orden de compra
            const purchaseOrderUpdate = await purchaseOrderService.updatePurchaseOrderLinesFromPayloadByExternalIds(purchaseOrderExternalId, purchaseNewLines);

            if (purchaseOrderUpdate.statusCode !== 200) return purchaseOrderUpdate;
            
            const purchaseOrder = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', purchaseOrderExternalId], ['model', '=', 'purchase.order'], ['module', '=', '__custom__']],
                fields: ['res_id']
            });

            const purchaseOrderLinesUpdated = await purchaseOrderService.getLinesByPurchaseOrderId(purchaseOrder.data[0].res_id,'full');
            
            //Finalmente actualizamos las lineas de la factura de compra

            const purchaseBillNewLines = purchaseNewLines.map(line => {

                const lineUpdated = purchaseOrderLinesUpdated.data.find(purchaseLine => purchaseLine.x_studio_n_remesa === line.x_studio_n_remesa);
                if( line.action === 'DELETE') return line;
                
                return {
                    ...line,
                    purchase_order_id: purchaseOrder.data[0].res_id,
                    purchase_line_id: lineUpdated ? lineUpdated.id : null,
                }
            }   )

            console.log("data para factura de compra",purchaseBillNewLines)
            console.log("purchaseBillExternalId",purchaseBillExternalId)
            const purchaseBillUpdate = await billService.updateBillLinesFromPayloadByExternalIds(purchaseBillExternalId, purchaseBillNewLines); 

            if (purchaseBillUpdate.statusCode !== 200) return purchaseBillUpdate;
            return {
                statusCode: 200,
                message: 'Líneas de venta, orden de compra y factura de compra actualizadas con éxito',
                data: {
                    quotationUpdate: quotationUpdate.data,
                    purchaseOrderUpdate: purchaseOrderUpdate.data,
                    purchaseBillUpdate: purchaseBillUpdate.data
                }
            };
                       

        }
        catch(error){
            console.error('Error al actualizar las ventas en Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al actualizar ventas',
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

    /**
     * Crea facturas de cliente a partir de órdenes de venta de forma individual.
     *
     * Flujo:
     *  1) Valida que los IDs existan y estén "to invoice".
     *  2) Crea una factura por cada grupo de órdenes especificado.
     *  3) Asigna External ID (uuid) a cada factura creada.
     *  4) Actualiza líneas y confirma cada factura con DIAN.
     *
     * @async
     * @param {Array<{ids: Array<number|string>, uuid: string}>} salesOrderGroups - Array de objetos con IDs de sale.order y uuid.
     * @returns {Promise<{
     *   statusCode: number,
     *   message: string,
     *   data: any,
     *   error?: any
     * }>}
     *  - 201: data es un arreglo con los IDs de las facturas creadas.
     *  - 400/404: validaciones fallidas (IDs inválidos o SO no encontradas).
     *  - 500: error al crear el wizard, generar facturas o leer líneas.
     *
     * @example
     * const res = await saleService.createBillFromSalesOrder([
     *   {ids: [101, 102], uuid: "uuid-123"},
     *   {ids: [103], uuid: "uuid-456"}
     * ]);
     * if (res.statusCode === 201) {
     *   console.log('Facturas:', res.data); // [{invoiceId: 1, uuid: "uuid-123"}, ...]
     * }
     */
    async createBillFromSalesOrder(salesOrderGroups) {
        try {
            // Validar el array de grupos
            if (!salesOrderGroups || salesOrderGroups.length === 0) {
                return { statusCode: 400, message: 'Debe proporcionar al menos un grupo de órdenes de venta', data: [] };
            }

            console.log('Iniciando creación de facturas desde órdenes de venta...');
            console.log('Grupos recibidos:', salesOrderGroups);

            const createdInvoices = [];

            // Procesar cada grupo de órdenes de venta
            for (const group of salesOrderGroups) {
                try {
                    const { ids: salesOrderIds, uuid } = group;

                    // Validar que el grupo tenga IDs y uuid
                    if (!salesOrderIds || salesOrderIds.length === 0) {
                        createdInvoices.push({
                            error: 'El grupo no tiene IDs de órdenes de venta',
                            uuid: uuid || 'sin uuid',
                            statusCode: 400
                        });
                        continue;
                    }

                    if (!uuid) {
                        createdInvoices.push({
                            error: 'El grupo no tiene UUID',
                            ids: salesOrderIds,
                            statusCode: 400
                        });
                        continue;
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

                            console.log('Resultado búsqueda External ID:', externalIdSearch);
                            if (externalIdSearch.success && externalIdSearch.data.length > 0) {
                                saleOrderId = externalIdSearch.data[0].res_id;
                            } else {
                                createdInvoices.push({
                                    error: `No se encontró orden de venta con External ID: ${orderId}`,
                                    uuid: uuid,
                                    statusCode: 404
                                });
                                continue;
                            }
                        } else {
                            saleOrderId = Number(orderId);
                        }

                        resolvedIds.push(saleOrderId);
                    }

                    // Si no hay IDs resueltos, continuar con el siguiente grupo
                    if (resolvedIds.length === 0) {
                        continue;
                    }

                    console.log(resolvedIds, "IDs de órdenes de venta resueltos para facturar");
                    // Verificar que las órdenes de venta existan
                    const getSaleOrders = await quotationService.getQuotation(['id'], [['invoice_status', '=', 'to invoice'], ['id', 'in', resolvedIds]]);
                    if (getSaleOrders.statusCode !== 200) {
                        createdInvoices.push({
                            error: getSaleOrders.message,
                            uuid: uuid,
                            statusCode: getSaleOrders.statusCode
                        });
                        continue;
                    }

                    console.log("Órdenes de venta encontradas para facturar:", getSaleOrders);
                    if (getSaleOrders.data.length !== resolvedIds.length) {
                        createdInvoices.push({
                            error: `Órdenes de venta no encontradas o ya facturadas: ${resolvedIds.filter(id => !getSaleOrders.data.map(order => order.id).includes(id)).join(', ')}`,
                            uuid: uuid,
                            statusCode: 404
                        });
                        continue;
                    }

                    // Mapear los IDs para el wizard
                    const ids = resolvedIds.map(id => [4, Number(id)]);

                    // Crear el wizard para facturación individual (sin consolidar)
                    const wizardCreate = await odooConector.executeOdooRequest('sale.advance.payment.inv', 'create', {
                        vals_list: [{
                            sale_order_ids: ids,
                            advance_payment_method: 'delivered',
                            consolidated_billing: true,
                        }],
                        context: { active_model: 'sale.order', active_ids: ids, active_id: ids[0] }
                    });

                    if (!wizardCreate.success) {
                        createdInvoices.push({
                            error: 'Error creando wizard facturación',
                            uuid: uuid,
                            statusCode: 500,
                            detail: wizardCreate.data
                        });
                        continue;
                    }

                    const wizardId = wizardCreate.data[0];

                    // Crear la factura
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

                    if (response.error || !response.success) {
                        createdInvoices.push({
                            error: 'Error al crear factura desde orden de venta',
                            uuid: uuid,
                            statusCode: response.error ? 500 : 400,
                            detail: response.message || response.data
                        });
                        continue;
                    }

                    const invoices = response.data.res_id == 0 ? response.data.domain[0][2] : [response.data.res_id];

                    // Procesar cada factura creada
                    for (const invoice of invoices) {
                        try {
                            // Crear External ID para la factura
                            const externalIdResponse = await odooConector.createExternalId(uuid, 'account.move', invoice);

                            if (!externalIdResponse.success) {
                                console.warn(`No se pudo crear el External ID ${uuid} para la factura ${invoice}:`, externalIdResponse.message);
                            }

                            // Obtener las órdenes de venta relacionadas a esta factura
                            const saleOrders = await billService.getSaleOrdersByBillId(invoice);

                            // Obtener las líneas de esas órdenes de venta
                            const invoiceLines = [];
                            for (const saleOrder of saleOrders.data) {
                                const lines = await odooConector.executeOdooRequest('sale.order.line', 'search_read', {
                                    domain: [['order_id', '=', saleOrder.id]]
                                });

                                if (!lines.success) {
                                    console.error(`Error al obtener líneas de orden de venta ${saleOrder.id}`);
                                    continue;
                                }

                                // Agregar las líneas de la orden de venta a las de la factura
                                for (const line of lines.data) {
                                    line.product_id = line.product_id[0];
                                    invoiceLines.push(line);
                                }
                            }

                            // Actualizar la factura con las líneas obtenidas y el tipo de operación
                            await billService.updateBill(invoice, {
                                invoice_line_ids: invoiceLines,
                                l10n_co_edi_operation_type: "12",
                                l10n_co_edi_payment_option_id: 66
                            }, 'update');

                            // Confirmar la factura y enviar a la DIAN
                            await billService.confirmCreditNote(invoice);

                            createdInvoices.push({
                                invoiceId: invoice,
                                uuid: uuid,
                                externalId: externalIdResponse.success ? uuid : null,
                                statusCode: 201
                            });
                        } catch (invoiceError) {
                            console.error(`Error procesando factura ${invoice}:`, invoiceError);
                            createdInvoices.push({
                                invoiceId: invoice,
                                uuid: uuid,
                                error: invoiceError.message,
                                statusCode: 500
                            });
                        }
                    }

                } catch (groupError) {
                    console.error('Error procesando grupo de órdenes:', groupError);
                    createdInvoices.push({
                        error: groupError.message,
                        uuid: group.uuid || 'sin uuid',
                        statusCode: 500
                    });
                }
            }

            // Verificar si todas las facturas fallaron
            const allFailed = createdInvoices.every(inv => inv.statusCode !== 201);
            if (allFailed && createdInvoices.length > 0) {
                return {
                    statusCode: 500,
                    message: 'Error: Todas las facturas fallaron en su creación',
                    data: createdInvoices
                };
            }

            return {
                statusCode: 201,
                message: 'Proceso de creación de facturas completado',
                data: createdInvoices
            };

        } catch (error) {
            console.error('Error al crear facturas desde órdenes de venta en Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al crear facturas desde órdenes de venta',
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
                    console.log("Procesando venta:", sale);
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

                    dataVenta.company_id = "company_" + externalCompanyId;
                    delete dataVenta.external_solicitud_transportista;
                    delete dataVenta.externalCompanyId;



                    //crear cotizacion
                    const quotation = await quotationService.createQuotation(dataVenta);
                    if (quotation.statusCode !== 201) return quotation;

                    console.log(quotation.data.id, "Este es el ID de la cotización creada");

                    //crear external ID para la cotizacion
                    const externalSalseOrderIdName = dataVenta.external_sale_order_id;
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
                    const createExternalIdorder = await odooConector.createExternalId(dataCompra.external_purchase_order_id, 'purchase.order', purchaseOrderId);

                    //Confirmar orden de compra
                    const confirmPurchaseOrder = await purchaseOrderService.confirmPurchaseOrder(purchaseOrderId);
                    if (confirmPurchaseOrder.statusCode !== 200) return confirmPurchaseOrder;


                    //crear la factura de la orden de compra
                    const bill = await purchaseOrderService.createBillFromPurchaseOrder([purchaseOrderId]);
                    if (bill.statusCode !== 201) return bill;

                    //Crear External ID para la factura de compra
                    const externalPurchaseIdName = dataCompra.external_bill_id;
                    console.log("Venta ", sale);
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

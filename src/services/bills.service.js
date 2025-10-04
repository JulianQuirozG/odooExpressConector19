const { da, ta } = require("zod/locales");
const dianRequest = require('../json-template/sale/saleDian.json')
const {
    BILL_FIELDS,
    PRODUCT_FIELDS,
    PRODUCT_FIELDS_BILL,
    INVOICE_LINE_FIELDS,
} = require("../utils/fields");
const jsonDatabase = require('../json-template/database.json')
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const productService = require("./products.service");
const partnerService = require("./partner.service");
const { updateBill } = require("../controllers/bill.controller");
const { journalService } = require("./journal.service");
const paramsTypeDocumentRepository = require("../Repository/params_type_document/params_type_document.repository");
const paramsTypeDocumentIdentificationRepository = require("../Repository/params_type_document_identification.repository/params_type_document_identification.repository");
const paramsMunicipalitiesRepository = require("../Repository/params_municipalities/params_municipalities.repository");
const paramsPaymentMethodsRepository = require("../Repository/params_payment_methods/params_payment_methods.repository");
const paramsLiabilitiesRepository = require("../Repository/param_type_liabilities/param_type_liabilities.repository");
const { json } = require("zod");
const { getUnitMeasureByCode, createUnitMeasure } = require("../Repository/param_unit_measures/params_unit_measures");
const { createTax, getTaxByCode } = require("../Repository/param_taxes/params_unit_measures");
const billService = {
    //obtener todas las facturas
    async getBills(billFields = ["name", "invoice_partner_display_name", "invoice_date", "invoice_date_due", "ref", "amount_untaxed_in_currency_signed", "state"]) {
        try {
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "search_read",
                {
                    fields: billFields,
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al obtener facturas",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al obtener facturas",
                    data: response.data,
                };
            }
            return {
                statusCode: 200,
                message: "Lista de facturas",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en billService.getBills:", error);
            return {
                statusCode: 500,
                message: "Error al obtener facturas",
                error: error.message,
            };
        }
    },
    //obtener una factura por id
    async getOneBill(id, domain = []) {
        try {
            const domainFinal = [['id', '=', Number(id)], ...domain];
            const response = await odooConector.executeOdooRequest(
                "account.move",
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
                        message: "Error al obtener factura",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al obtener factura",
                    data: response.data,
                };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: "Factura no encontrada" };
            }
            return {
                statusCode: 200,
                message: "Detalle de la factura",
                data: response.data[0],
            };
        } catch (error) {
            console.log("Error en billService.getOneBill:", error);
            return {
                statusCode: 500,
                message: "Error al obtener factura",
                error: error.message,
            };
        }
    },
    //crear una factura
    async createBill(dataBill) {
        try {
            //verifico al partner si viene en el body
            if (dataBill.partner_id) {
                const partnerResponse = await partnerService.getOnePartner(
                    dataBill.partner_id
                );
                if (partnerResponse.statusCode !== 200) {
                    return {
                        statusCode: partnerResponse.statusCode,
                        message: "No se puede crear la factura porque el partner no existe",
                        error: partnerResponse.message,
                    };
                }
            }
            //obtengo los datos de la factura
            const bill = pickFields(dataBill, BILL_FIELDS);
            //si tiene productos los verifico
            if (dataBill.invoice_line_ids && dataBill.invoice_line_ids.length > 0) {
                const productIds = dataBill.invoice_line_ids.map((line) =>
                    Number(line.product_id)
                );
                //le paso la lista de ids de productos sin repetidos para verificar que existan
                const productsResponse = await productService.validListId([
                    ...new Set(productIds),
                ]);

                if (productsResponse.statusCode === 200) {
                    //filtro las lineas de la factura para quedarme solo con las que tienen productos existentes
                    const cosas = dataBill.invoice_line_ids.filter((line) =>
                        productsResponse.data.foundIds.includes(Number(line.product_id))
                    );
                    bill.invoice_line_ids = cosas.map((line) => [0, 0, line]);
                }
            }

            const response = await odooConector.executeOdooRequest(
                "account.move",
                "create",
                {
                    vals_list: [bill],
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al crear factura",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al crear factura",
                    data: response.data,
                };
            }
            return {
                statusCode: 201,
                message: "Factura creada con éxito",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en billService.createBill:", error);
            return {
                statusCode: 500,
                message: "Error al crear factura",
                error: error.message,
            };
        }
    },
    //actualizar una factura
    async updateBill(id, dataBill, action = 'replace') {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }
            //verifico al partner si viene en el body
            const bill = pickFields(dataBill, BILL_FIELDS);

            if (dataBill.invoice_line_ids && dataBill.invoice_line_ids.length >= 0) {
                const lineIds = billExists.data.invoice_line_ids;

                //si viene replace borro todas las lineas anteriores y agrego las nuevas
                //verifico si hay lineas para agregar
                if (dataBill.invoice_line_ids.length > 0) {
                    //le saco el id de los productos al body y verifico que existan
                    const productResponse = await productService.validListId(
                        dataBill.invoice_line_ids.map((line) => {
                            return Number(line.product_id);
                        })
                    );
                    //obtengo las lineas que tienen productos existentes
                    const linesToAdd = dataBill.invoice_line_ids.filter((line) =>
                        productResponse.data.foundIds.includes(Number(line.product_id))
                    );



                }
                if (action === 'replace') {
                    //si hay lineas las elimino
                    console.log(linesToAdd);
                    //construyo las lineas que deben ir en el body para construir
                    const productsFound = linesToAdd.map((line) => [0, 0, pickFields(line, INVOICE_LINE_FIELDS)]);
                    bill.invoice_line_ids = productsFound;
                    console.log(bill);
                    if (lineIds.length > 0) {
                        const deleted = await this.updateBillLines(id, 2, lineIds);
                        if (deleted.statusCode !== 200) {
                            return deleted;
                        }
                    }
                } else if (action === 'update') {
                    //si viene update ceirfico el tamaño de las linas y las actualizo
                    console.log('Verificando lineas a actualizar', dataBill.invoice_line_ids.map((line) => { return pickFields(line, INVOICE_LINE_FIELDS); }));
                    await this.verifyBillLines(id, dataBill.invoice_line_ids.map((line) => { return pickFields(line, INVOICE_LINE_FIELDS); }));
                }
            }

            //Actualizo la factura
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "write",
                {
                    ids: [Number(id)],
                    vals: bill,
                }
            );

            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al actualizar factura",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al actualizar factura",
                    data: response.data,
                };
            }

            //Regreso la factura actualizada
            const updateBill = await this.getOneBill(id);
            if (updateBill.statusCode !== 200) return updateBill;
            return {
                statusCode: 200,
                message: "Factura actualizada con éxito",
                data: updateBill.data,
            };
        } catch (error) {
            console.log("Error en billService.updateBill:", error);
            return {
                statusCode: 500,
                message: "Error al actualizar factura",
                error: error.message,
            };
        }
    },
    async verifyBillLines(id, lines) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            const lineIds = billExists.data.invoice_line_ids;

            if (lines.length !== lineIds.length || lines.length === 0) {
                return {
                    statusCode: 400,
                    message: "La cantidad de lineas no coincide con las existentes",
                };
            }

            const productsIds = await productService.validListId(lines.map((line) => line.product_id));

            if (productsIds.statusCode !== 200 || productsIds.data.foundIds.length !== lines.length) {
                return {
                    statusCode: 400,
                    message: "Los productos no son válidos",
                };
            }

            const response = await this.updateBillLines(id, 1, lines);
            if (response.statusCode !== 200) {
                return response;
            }
            return {
                statusCode: 200,
                message: "Líneas de factura actualizadas con éxito",
                data: response.data,
            };

        } catch (error) {

        }
    },
    //eliminar una factura
    async deleteBill(id) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "unlink",
                {
                    ids: [Number(id)],
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al eliminar factura",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al eliminar factura",
                    data: response.data,
                };
            }
            return {
                statusCode: 200,
                message: "Factura eliminada con éxito",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en billService.deleteBill:", error);
            return {
                statusCode: 500,
                message: "Error al eliminar factura",
                error: error.message,
            };
        }
    },
    //confirmar una factura
    async confirmBill(id) {
        try {
            const billExists = await this.getOneBill(id, [['state', '!=', 'posted']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message + " o ya está confirmada",
                    data: billExists.data,
                };
            }
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "action_post",
                {
                    ids: [Number(id)],
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al confirmar factura",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al confirmar factura",
                    data: response.data,
                };
            }
            return {
                statusCode: 200,
                message: "Factura confirmada con éxito",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en billService.confirmBill:", error);
            return {
                statusCode: 500,
                message: "Error al confirmar factura",
                error: error.message,
            };
        }
    },
    //reestablecer una factura a borrador
    async resetToDraftBill(id) {
        try {
            const billExists = await this.getOneBill(id, [['state', '!=', 'draft']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "button_draft",
                {
                    ids: [Number(id)],
                }
            );
            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al reestablecer factura a borrador",
                        error: response.message,
                    };
                }
                return {
                    statusCode: 400,
                    message: "Error al reestablecer factura a borrador",
                    data: response.data,
                };
            }
            return {
                statusCode: 200,
                message: "Factura reestablecida a borrador con éxito",
                data: response.data,
            };
        } catch (error) {
            console.log("Error en billService.resetToDraftBill:", error);
            return {
                statusCode: 500,
                message: "Error al reestablecer factura a borrador",
                error: error.message,
            };
        }
    },
    //Crear una nota de debito a partir de una factura confirmada
    async createDebitNote(id, dataDebit) {
        try {
            const billExists = await this.getOneBill(id, [['state', '=', 'posted']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            // Crear el wizard de nota de débito
            const wizardData = {
                move_ids: [[6, 0, [Number(id)]]],
                reason: dataDebit.reason || "Nota de débito",
                date: dataDebit.date || new Date().toISOString().split("T")[0],
                journal_id: dataDebit.journal_id || false,
            };

            const wizardResponse = await odooConector.executeOdooRequest(
                "account.debit.note",
                "create",
                {
                    vals_list: [wizardData],
                }
            );

            if (!wizardResponse.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear wizard de nota de débito",
                    error: wizardResponse.message,
                };
            }

            // Ejecutar la creación de la nota de débito
            const debitNoteResponse = await odooConector.executeOdooRequest(
                "account.debit.note",
                "create_debit",
                {
                    ids: wizardResponse.data,
                }
            );

            if (!debitNoteResponse.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear nota de débito",
                    error: debitNoteResponse.message,
                };
            }

            return {
                statusCode: 201,
                message: "Nota de débito creada con éxito",
                data: debitNoteResponse.data,
            };
        } catch (error) {
            console.log("Error en billService.createDebitNote:", error);
            return {
                statusCode: 500,
                message: "Error al crear nota de débito",
                error: error.message,
            };
        }
    },
    //Crear una nota de credito a partir de una factura confirmada
    async createCreditNote(id, dataCredit) {
        try {
            // Verificar que la factura exista y esté confirmada
            const billExists = await this.getOneBill(id, [['state', '=', 'posted']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            // Crear el wizard de nota de credito
            const wizardData = {
                move_ids: [Number(id)],
                reason: "Anulación",
                "l10n_co_edi_description_code_credit": "2",
                date: dataCredit.date || new Date().toISOString().split("T")[0],
                journal_id: dataCredit.journal_id || false,
            };

            const wizardResponse = await odooConector.executeOdooRequest(
                "account.move.reversal",
                "create",
                {
                    vals_list: [wizardData],
                }
            );

            if (!wizardResponse.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear wizard",
                    error: wizardResponse.message,
                };
            }

            //Crear la nota de credito
            const creditNoteResponse = await odooConector.executeOdooRequest(
                "account.move.reversal",
                "reverse_moves",
                {
                    ids: wizardResponse.data,
                }
            );

            if (!creditNoteResponse.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear nota de crédito",
                    error: creditNoteResponse.message,
                };
            }


            const creditNoteId = creditNoteResponse.data.res_id;

            //Consigo las lineas de la factura original
            const lines = await this.getLinesByBillId(id);
            if (lines.statusCode !== 200) {
                return lines;
            }

            //Actualizo los productos de la nota credito con los productos de la factura original
            const updatedCreditNote = await this.updateBill(creditNoteId, {
                invoice_line_ids: lines.data
            }, 'update');
            if (updatedCreditNote.statusCode !== 200) {
                return updatedCreditNote;
            }

            //Regreso la nota credito creada
            return {
                statusCode: 201,
                message: "Nota de crédito creada con éxito",
                data: creditNoteResponse.data,
            };
        } catch (error) {
            console.log("Error en billService.createCreditNote:", error);
            return {
                statusCode: 500,
                message: "Error al crear nota de crédito",
                error: error.message,
            };
        }
    },
    // Crear un pago para una factura de una factura confirmada
    async createPayment(invoiceId, paymentDatas) {
        try {
            //Verificar que el id sea valido
            if (!invoiceId || isNaN(Number(invoiceId))) {
                return {
                    statusCode: 400,
                    message: "ID de factura inválido",
                    data: null,
                };
            }

            // Verificar que la factura exista y esté confirmada
            const billExists = await this.getOneBill(invoiceId, [['state', '=', 'posted']]);
            console.log(billExists);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            // Obtener el monto residual de la factura
            const invoice = billExists.data;
            const residual = invoice.amount_residual;

            // Validar y ajustar el monto
            if (paymentDatas.amount <= 0) return { statusCode: 400, message: "El monto del pago debe ser positivo", data: [] };


            const wizardData = {
                payment_date: paymentDatas.date || new Date().toISOString().split("T")[0],
                communication: paymentDatas.memo || `Pago de ${invoice.name}`,
                amount: paymentDatas.amount || residual,
                journal_id: paymentDatas.journal_id || false,
                payment_method_line_id: Number(paymentDatas.payment_method_line_id) || false,
                communication: invoice.payment_reference || ""

            };
            console.log("Datos del wizard de pago:", wizardData);
            // Crear el wizard con la estructura correcta
            const wizardCreate = await odooConector.executeOdooRequest(
                'account.payment.register',
                'create',
                {
                    vals_list: wizardData, // ✅ Objeto directo, no array
                    context: {
                        active_model: 'account.move',
                        active_ids: [Number(invoiceId)]
                    }
                }
            );

            if (!wizardCreate.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear el asistente de pago",
                    error: wizardCreate.message,
                };
            }

            // CORREGIDO: Obtener el ID correctamente
            const wizardId = Array.isArray(wizardCreate.data) ? wizardCreate.data[0] : wizardCreate.data;

            // Crear el pago
            const payment = await odooConector.executeOdooRequest(
                'account.payment.register',
                'action_create_payments',
                { ids: [wizardId] }
            );

            if (!payment.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear el pago",
                    error: payment.message,
                };
            }

            // Obtener información actualizada de la factura
            const updatedInvoice = await this.getOneBill(invoiceId);

            return {
                statusCode: 201,
                message: "Pago creado con éxito",
                data: payment.data,
                invoice: updatedInvoice.statusCode === 200 ? updatedInvoice.data : null
            };



        } catch (error) {
            console.log("Error en billService.createPayment:", error);
            return {
                statusCode: 500,
                message: "Error al crear pago",
                error: error.message,
            };
        }
    },
    async listOutstandingCredits(invoiceId) {
        try {
            const billExists = await this.getOneBill(invoiceId, [['state', '=', 'posted']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            //ahora obtengo los datos del campo "invoice_outstanding_credits_debits_widget" donde se listan los pagos
            const outstandingCredits = billExists.data.invoice_outstanding_credits_debits_widget;

            if (!outstandingCredits) {
                return {
                    statusCode: 200,
                    message: "Notas de crédito pendientes obtenidas con éxito",
                    data: [],
                };
            }

            return {
                statusCode: 200,
                message: "Notas de crédito pendientes obtenidas con éxito",
                data: outstandingCredits.content,
            };
        } catch (error) {
            console.log("Error en billService.listOutstanding_credits:", error);
            return {
                statusCode: 500,
                message: "Error al obtener notas de credito pendientes",
                error: error.message,
            };
        }
    },
    async applyCreditNote(invoiceId, creditMoveId) {
        try {
            //Consultar notas de credito del cliente
            const outstandingCredits = await this.listOutstandingCredits(invoiceId);
            const creditToApply = outstandingCredits.data.find(credit => credit.id === creditMoveId);


            console.log(creditToApply);
            if (!creditToApply) {
                return {
                    statusCode: 404,
                    message: "La nota de crédito no se encuentra entre las pendientes",
                    data: null
                };
            }

            const response = await odooConector.executeOdooRequest(
                'account.move',
                'js_assign_outstanding_line',
                {
                    ids: Number(invoiceId),
                    line_id: Number(creditMoveId)
                });

            if (!response.success) {
                if (response.error) {
                    return {
                        statusCode: 500,
                        message: "Error al aplicar nota de crédito",
                        error: response.message
                    };
                }
                return { statusCode: 400, message: "Error al aplicar nota de crédito", data: response.data };
            }
            return { statusCode: 200, message: "Nota de crédito aplicada con éxito", data: response.data };

        } catch (error) {
            console.log("Error en billService.applyCreditNote:", error);
            return {
                statusCode: 500,
                message: "Error al aplicar nota de crédito",
                error: error.message
            };
        }
    },
    async updateBillLines(id, action, lines) {
        try {
            //verificamos que la orden de compra exista
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }
            //validamos la acción a realizar
            const validActions = [1, 2, 3, 5, 6];
            if (!validActions.includes(action)) {
                return { statusCode: 400, message: 'Acción no válida. Use 1(Actualizar), 2 (eliminar), 3 (desconectar), 5 (eliminar todas), o 6 (reemplazar).' };
            }

            let lineCommands = [];
            //verificamos que si la accion requiere lineas, de ids, o de información, estas existan
            if (action === 2 || action === 3) {
                if (!lines || !Array.isArray(lines) || lines.length === 0) {
                    return { statusCode: 400, message: 'Debe proporcionar una lista de IDs de líneas para las acciones 2 o 3.' };
                }
            }

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
                actions = lines.map((line, index) => { return [1, billExists.data.invoice_line_ids[Number(index)], line] });
            }

            console.log('Actions for updatePurchaseOrderLines:', actions);
            const response = await odooConector.executeOdooRequest("account.move", "write", {
                ids: [Number(id)],
                vals: {
                    invoice_line_ids: actions
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
    async getLinesByBillId(id, action = 'id') {
        try {
            //Verificar que la factura exista
            const bill = await this.getOneBill(id);
            if (bill.statusCode !== 200) {
                return bill;
            }

            //Buscar las lineas de esa factura
            const lines = await odooConector.executeOdooRequest('account.move.line', 'search_read', { domain: [['id', 'in', bill.data.invoice_line_ids]] });
            if (!lines.success) {
                if (lines.error) {
                    return { statusCode: 500, message: 'Error al obtener líneas de orden de compra', error: lines.message };
                }
                return { statusCode: 400, message: 'Error al obtener líneas de orden de compra', data: lines.data };
            }

            //Formateo las lineas para que el product_id sea solo el id y no un array con id y nombre
            if (action === 'id') {
                lines.data = lines.data.map(line => line.product_id = line.product_id[0]);
            }

            //Regreso las lineas obtenidas
            return { statusCode: 200, message: 'Líneas de orden de compra obtenidas con éxito', data: lines.data };
        } catch (error) {
            console.error("Error getting lines by bill ID:", error);
            return {
                statusCode: 500,
                message: 'Error al obtener líneas de orden de compra',
                error: error.data
            };
        }
    },
    async createJsonDian(billId) {
        try {
            const jsonDian = { ...dianRequest };

            //Obtengo todos los datos de la factura
            const bill = await this.getOneBill(billId); //Solo facturas confirmadas y firmadas
            if (bill.statusCode !== 200) return bill;

            if(bill.state === 'draft' ) return { statusCode: 400, message: "La factura debe estar en estado post para generar el JSON" };
            //Fecha y hora de la factura
            const post_time = bill.data.l10n_co_dian_post_time.split(' ');
            const date = post_time[0];//
            const time = post_time[1];//

            //consecutivo y prefix de la factura
            const bill_name = bill.data.name.split('/');
            const number = bill_name[2];//
            const prefix = bill_name[0];//

            //tipo de documento
            const move_type = bill.data.l10n_co_edi_type;
            const { data } = await paramsTypeDocumentRepository.getTypeDocumentByCode(move_type);
            if (data.length < 1) return { statusCode: 404, message: "El tipo de documento no está configurado en la tabla de parámetros" };
            const type_document_id = data[0]; //

            // //Obtengo los datos del cliente
            const bill_customer = await partnerService.getOnePartner(bill.data.partner_id[0]);
            let customer = {}; //

            //sendEmail
            const sendEmail = bill_customer.data.followup_reminder_type == "automatic";
            //documento del cliente
            const vat = bill_customer.data.vat.split('-');
            customer.identification_number = vat[0];
            customer.dv = vat[1];

            //nombre, telefono, direccion y email del cliente
            if (!bill_customer.data.name) return { statusCode: 400, message: "El cliente no tiene nombre" };
            customer.name = bill_customer.data.name;
            if (bill_customer.data.phone) customer.phone = bill_customer.data.phone;
            if (bill_customer.data.email) customer.email = bill_customer.data.email;
            if (bill_customer.data.address) customer.address = bill_customer.data.address;

            //registro mercantil
            //customer.merchant_registration = 


            //tipo de documento de identificacion 
            const customer_l10n_latam_identification_type_id = bill_customer.data.l10n_latam_identification_type_id;
            const type_document_identification_id = await paramsTypeDocumentIdentificationRepository.getTypeDocumentByCode(customer_l10n_latam_identification_type_id[0]);
            if(type_document_identification_id.data.length > 0) customer.type_document_identification_id = type_document_identification_id.data[0].id; //

            //tipo de organizacion
            customer.type_organization_id = bill_customer.data.is_company ? 1 : 2;

            //municipio
            const city = await odooConector.executeOdooRequest("res.city", "search_read", { domain: [['id', '=', bill_customer.data.city_id[0]]] });
            if (city.data.length !== 0) customer.municipality_id = (await paramsMunicipalitiesRepository.getMunicipalityByCode(city.data[0].l10n_co_edi_code)).data[0].id;

            //tipo de regimen
            const fiscal_regimen = bill_customer.data.l10n_co_edi_fiscal_regimen;
            customer.type_regime_id = (fiscal_regimen === "49") ? 2 : 1;

            //Tipo de responsabilidad
            const obligation_id = bill_customer.data.l10n_co_edi_obligation_type_ids;
            if (obligation_id.length === 0) return { statusCode: 400, message: "El cliente no tiene tipo de responsabilidad" };
            const obligation_type = (await odooConector.executeOdooRequest("l10n_co_edi.type_code", "search_read", { domain: [['id', '=', obligation_id[0]]] })).data[0];
            const type_liability = await paramsLiabilitiesRepository.getTypeLiabilitiesByCode(obligation_type.name);
            if (type_liability.data.length < 1) return { statusCode: 404, message: "El tipo de responsabilidad no está configurado en la tabla de parámetros" };
            customer.type_liability_id = type_liability.data[0].id;

            //Forma de pago
            const payment_form = {}

            //Id de la forma de pago
            //Si eligio la opcion de pagar en otra fecha es credito
            payment_form.payment_form_id = 2;

            //Si no es pago inmediato, es credito
            if (bill.data.invoice_payment_term_id[0] == 1) payment_form.payment_form_id = 1;

            //Metodo de pago id
            const payment_id = bill.data.l10n_co_edi_payment_option_id[0];
            const payment_method = (await odooConector.executeOdooRequest("l10n_co_edi.payment.option", "search_read", { domain: [['id', '=', payment_id]] }));

            const payment_method_id = (await paramsPaymentMethodsRepository.getPaymentMethodByCode(payment_method.data[0].code));
            if (payment_method_id.data.length < 1) return { statusCode: 404, message: "El método de pago no está configurado en la tabla de parámetros" };
            payment_form.method_payment_id = payment_method_id.data[0].id;


            //fecha de pago
            payment_form.payment_due_date = bill.data.invoice_date_due;

            //Duracion del pago (Calculado en dias dependiendo la fecha de la factura y la feca del pago)
            const invoice_date = new Date(bill.data.invoice_date);
            const invoice_date_due = new Date(bill.data.invoice_date_due);

            //Calculo la diferencia en milisegundos
            const diferenciaMs = invoice_date_due - invoice_date;
            const dias = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));
            payment_form.duration_measure = dias;


            // totales
            const legal_monetary_totals = {
                payable_amount: bill.data.amount_untaxed,
                tax_exclusive_amount: bill.data.amount_untaxed,
                tax_inclusive_amount: bill.data.amount_untaxed,
                line_extension_amount: 0,
                allowance_total_amount: bill.data.amount_total,
                payable_amount: bill.data.amount_total,
            }


            //Numero de resolucion de la factura
            const journalData = await journalService.getOneJournal(bill.data.journal_id[0]);
            if (journalData.statusCode !== 200) return journalData;
            if(!journalData.data.l10n_co_edi_dian_authorization_number) return { statusCode: 400, message: "El diario no tiene configurado un  número de resolución DIAN" };
            const resolution_number = journalData.data.l10n_co_edi_dian_authorization_number;

            //impuestos totales
            const tax_totals = [];

            const lines = await this.getLinesByBillId(bill.data.id, 'full');
            if (lines.statusCode !== 200) return lines;

            //Tomo las lineas y construyo lo invoice_lines
            const linesProduct = [];
            let tax_totals_bill = [];
            const tax_totals_map = new Map();
            for (const line of lines.data) {
                //obtengo la unidad de medida
                const unitMeassure = await odooConector.executeOdooRequest("uom.uom", "search_read", { domain: [['id', '=', line.product_uom_id[0]]] });
                if(unitMeassure.error) return { statusCode: 500, message: "Error al obtener la unidad de medida", error: unitMeassure.message };
                if(!unitMeassure.success) return { statusCode: 400, message: "Error al obtener la unidad de medida", data: unitMeassure.data };
                if (unitMeassure.data.length === 0) return { statusCode: 404, message: `La unidad de medida ${line.product_uom_id[0]} de la linea ${line.id} no existe` };
                
                const identificador = unitMeassure.data[0].l10n_co_edi_ubl;
                //busco la unidad de medida en la tabla de parametros
                const unit_measure_id = await getUnitMeasureByCode(identificador);
                if (unit_measure_id.data.length === 0) return { statusCode: 404, message: `La unidad de medida con código ${identificador} no está configurada en la tabla de parámetros` };

                let lines2 = {};

                lines2.code = line.product_id[0];
                lines2.notes = line.name || "";
                lines2.description = line.product_id[1];
                lines2.price_amount = line.price_unit;
                lines2.base_quantity = line.quantity;
                lines2.unit_measure_id = Number(unit_measure_id.data[0].id);
                lines2.invoiced_quantity = line.quantity;
                lines2.line_extension_amount = line.price_total;
                lines2.free_of_charge_indicator = false; //de donde saco esto
                lines2.type_item_identification_id = 4; //Esteban me dijo que siempre es 4
                if (bill.data.l10n_co_edi_operation_type === '12') {
                    lines2.is_RNDC = true; 
                    if(!line.x_studio_rad_rndc) return { statusCode: 400, message: `La linea ${line.id} no tiene número de radicado RNDC` };
                    if(!line.x_studio_n_remesa) return { statusCode: 400, message: `La linea ${line.id} no tiene número de remesa interna` };
                    lines2.RNDC_consignment_number = line.x_studio_rad_rndc || "";
                    lines2.internal_consignment_number = line.x_studio_n_remesa || "";
                    lines2.value_consignment = 0; //FALTA
                    lines2.unit_measure_consignment_id = Number(unit_measure_id.data[0].id);  //FALTA
                    lines2.quantity_consignment = line.quantity;
                }
                const tax_totals = [];
                if (line.tax_ids.length === 0) return { statusCode: 400, message: `La linea ${line.id} no tiene impuestos` };


                for (const tax of line.tax_ids) {
                    let tax_line = {};

                    //obtengo los datos del impuesto
                    const taxData = await odooConector.executeOdooRequest("account.tax", "search_read", { domain: [['id', '=', Number(tax)]] });

                    if (taxData?.data.length === 0) return { statusCode: 400, message: `El impuesto ${tax} de la linea ${line.id} no es válido` };

                    const taxTypeData = await odooConector.executeOdooRequest("l10n_co_edi.tax.type", "search_read", { domain: [['id', '=', taxData.data[0].l10n_co_edi_type[0]]] });
                    if (taxTypeData.data.length === 0) return { statusCode: 400, message: `El tipo de impuesto ${taxData.data[0].l10n_co_edi_type[0]} del impuesto ${tax} de la linea ${line.id} no es válido` };

                    const tax_id = await getTaxByCode(taxTypeData.data[0].code);
                    if (tax_id.data[0].length === 0) return { statusCode: 404, message: `El tipo de impuesto con código ${taxTypeData.data[0].code} no está configurado en la tabla de parámetros` };

                    tax_line.tax_id = tax_id.data[0].id;
                    tax_line.tax_amount = taxData.data[0].amount === 0 ? 0 : line.price_subtotal * (taxData.data[0].amount / 100);
                    tax_line.percent = taxData.data[0].amount;
                    tax_line.taxable_amount = line.price_subtotal;


                    tax_totals.push({ ...tax_line });
                    //Agregar la cantidad de los impuestos
                    if (tax_totals_map.has(tax)) {
                        // Ya existe, sumar valores
                        const existing = tax_totals_map.get(tax_line.percent);
                        existing.tax_amount += tax_line.tax_amount;
                        existing.taxable_amount += tax_line.taxable_amount;
                        tax_totals_map.set(tax_line.percent, existing);
                    } else {
                        // Nuevo impuesto
                        tax_totals_map.set(tax_line.percent, {
                            tax_id: tax_line.tax_id,
                            tax_amount: tax_line.tax_amount,
                            percent: tax_line.percent,
                            taxable_amount: tax_line.taxable_amount
                        });
                    }

                }



                lines2.tax_totals = tax_totals;

                console.log(lines2);
                linesProduct.push(lines2);
            }

            tax_totals_map.forEach((valor, clave) => {
                tax_totals_bill.push(valor);
            })
            //construyo el json para la dian

            jsonDian.date = date;
            jsonDian.time = time;
            jsonDian.number = number;
            jsonDian.prefix = prefix;
            jsonDian.customer = customer;


            jsonDian.payment_form = payment_form;

            jsonDian.invoice_lines = linesProduct;

            jsonDian.type_document_id = type_document_id.id;
            jsonDian.resolution_number = resolution_number;
            jsonDian.legal_monetary_totals = legal_monetary_totals;
            jsonDian.tax_totals = tax_totals_bill;

            jsonDian.sendEmail = sendEmail;




            return {
                statusCode: 200,
                message: 'JSON para DIAN creado con éxito',
                data: jsonDian
            };

        } catch (error) {
            console.error('Error al crear el JSON para DIAN', error);
            return {
                statusCode: 500,
                message: 'Error al crear JSON DIAN',
                error: error.message
            };
        }

    }
};

module.exports = billService;

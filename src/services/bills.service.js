const { da } = require("zod/locales");
const dianRequest = require('../json-template/sale/saleDian.json')
const {
    BILL_FIELDS,
    PRODUCT_FIELDS,
    PRODUCT_FIELDS_BILL,
    INVOICE_LINE_FIELDS,
} = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const productService = require("./products.service");
const partnerService = require("./partner.service");
const { updateBill } = require("../controllers/bill.controller");
const { journalService } = require("./journal.service");

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
            const bill = await this.getOneBill(billId);

            if (bill.statusCode !== 200) return bill;
            //extraigo los datos que necesito del nombre y la fecha de la factura
            // el formato de la fecha es "2023-10-05 14:30:00"
            // el formato del nombre es "FV/2023/0001"

            const time = bill.data.l10n_co_dian_post_time.split(' ');
            const number = bill.data.name.split('/');

            console.log(...time)
            console.log(...number)

            let typedocument = 1;

            if (bill.data.move_type === 'out_refund') {
                typedocument = 4; //Factura de venta
            }
            if (bill.data.move_type === 'out_debit') {
                typedocument = 5; //Factura de devolución
            }


            //obtengo los datos del cliente
            const customer = await partnerService.getOnePartner(bill.data.partner_id[0]);
            if (customer.statusCode !== 200) return customer;

            const partner = customer.data;
            console.log(partner);
            const identification = partner.vat.split('-');
            //regimen 1 = IVA, 2 = NO IVA
            let regimen = 1;
            if (partner.l10n_co_edi_fiscal_regimen === "49") {
                regimen = 2;
            }

            //tipo de responsabilidad /
            /** 
            7	Gran contribuyente	O-13
            9	Autorretenedor	O-15
            14	Agente de retención en el impuesto sobre las ventas	O-23
            112	Régimen Simple de Tributación – SIMPLE	O-47
            117	No responsable	R-99-PN
            */
            let liability = null;
            if (partner.l10n_co_edi_obligation_type_ids[0] === 1) {
                liability = 112;
            }
            if (partner.l10n_co_edi_obligation_type_ids[0] === 2) {
                liability = 117;
            }
            if (partner.l10n_co_edi_obligation_type_ids[0] === 3) {
                liability = 7;
            }
            if (partner.l10n_co_edi_obligation_type_ids[0] === 4) {
                liability = 9;
            }
            if (partner.l10n_co_edi_obligation_type_ids[0] === 5) {
                liability = 14;
            }

            //tipo de organización
            /** 
            1	Persona Jurídica y asimiladas	1
            2	Persona Natural y asimiladas	2
            */
            let organization = null;

            if (partner.is_company) {
                organization = 1;
            } else {
                organization = 2;
            }

            /**
             * 
             *   1	Registro civil	11
             *   2	Tarjeta de identidad	12
             *   3	Cédula de ciudadanía	13
             *   4	Tarjeta de extranjería	21
             *   5	Cédula de extranjería	22
             *   6	NIT	31
             *   7	Pasaporte	41
             *   8	Documento de identificación extranjero	42
             *   9	NIT de otro país	50
             *   10	NUIP *	91
             *   11	PEP	47
             * 
             * 
             * 
                "id": 4,
                "display_name": "NIT",
                "id": 5,
                "display_name": "Cédula de ciudadanía",
                "id": 6,
                "display_name": "Registro Civil",
                "id": 7,
                "display_name": "Tarjeta de Identidad",
                "id": 8,
                "display_name": "Tarjeta de extranjería",
                "id": 9,
                "display_name": "Cédula de extranjería",
                "id": 2,
                "display_name": "Passport",
                "id": 10,
                "display_name": "PEP (Permiso Especial de Permanencia)",
             */

            let identity = null;
            if (partner.l10n_latam_identification_type_id == 2) {
                identity = 7;
            }
            if (partner.l10n_latam_identification_type_id == 4) {
                identity = 6;
            }
            if (partner.l10n_latam_identification_type_id == 5) {
                identity = 3;
            }
            if (partner.l10n_latam_identification_type_id == 7) {
                identity = 2;
            }
            if (partner.l10n_latam_identification_type_id == 8) {
                identity = 4;
            }
            if (partner.l10n_latam_identification_type_id == 9) {
                identity = 5;
            }
            if (partner.l10n_latam_identification_type_id == 10) {
                identity = 11;
            }



            const journalData = await journalService.getOneJournal(bill.data.journal_id[0]);
            if (journalData.statusCode !== 200) return journalData;
            const journal = journalData.data;


            const lines = await this.getLinesByBillId(bill.data.id, 'full');
            if (lines.statusCode !== 200) return lines;

            const linesProduct = lines.data.map(line => {
                return {

                    code: line.product_id[0],
                    notes: line.name || "",
                    description: line.product_id[1],
                    price_amount: line.price_total,
                    base_quantity: line.quantity,
                    unit_measure_id: 26,
                    invoiced_quantity: line.quantity,
                    line_extension_amount: line.price_subtotal,
                    free_of_charge_indicator: false,
                    type_item_identification_id: 999,//evaluar
                    is_RNDC: "true",
                    RNDC_consignment_number: line.x_studio_rad_rndc || "",
                    internal_consignment_number: line.x_studio_n_remesa || "",
                    value_consignment: "0",
                    unit_measure_consignment_id: 26,
                    quantity_consignment: line.quantity || 0,//evaluar
                    allowance_charges: {}

                }

            });

            //armo el json con los datos de la factura

            jsonDian.date = time[0];
            jsonDian.time = time[1];
            jsonDian.notes = ""; //FALTA
            jsonDian.number = number[2];
            jsonDian.prefix = number[0];

            jsonDian.customer = {
                dv: identification[1],
                name: partner.name || "",
                email: partner.email || "",
                phone: partner.phone || "",
                address: partner.street || "",
                //regimen
                type_regime_id: regimen,
                //municipalidad FALTAAAAAA
                municipality_id: 439,
                //tipo de contribuyente
                type_liability_id: liability || "",
                //tipo de organizacion
                type_organization_id: organization || "",
                identification_number: identification[0],
                merchant_registration: "0000000",
                //tipo de documento de identificacion
                type_document_identification_id: identity //FALTA
            }
            jsonDian.joi

            jsonDian.sendmail = partner.followup_remainder_type === 'automatic';
            //jsonDian.foot_note = "PRUEBA DE TEXTO LIBRE QUE DEBE POSICIONARSE EN EL PIE DE PAGINA";
            //jsonDian.head_note = "PRUEBA DE TEXTO LIBRE QUE DEBE POSICIONARSE EN EL ENCABEZADO DE PAGINA";
            jsonDian.payment_form = {
                payment_form_id: 2,
                duration_measure: "30", //FALTA
                payment_due_date: "2023-04-04", //CALCULAR
                payment_method_id: 75 //PREGUNTAR
            };
            jsonDian.invoice_lines = linesProduct;


            //lineas de totales
            jsonDian.type_document_id = typedocument;//FALTA
            jsonDian.resolution_number = journal.l10n_co_edi_dian_authorization_number; //FALTA
            jsonDian.legal_monetary_totals = {
                payable_amount: bill.data.amount_untaxed,
                tax_exclusive_amount: bill.data.amount_untaxed,
                tax_inclusive_amount: bill.data.amount_untaxed,
                line_extension_amount: 0,
                allowance_total_amount: bill.data.amount_total
            }


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

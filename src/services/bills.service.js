//utils
const dianRequest = require('../json-template/sale/saleDian.json')
const {
    BILL_FIELDS,
    INVOICE_LINE_FIELDS,
} = require("../utils/fields");

//Conectors
const odooConector = require("../utils/odoo.service");
const nextPymeConnection = require("../services/nextPyme.service");
const { pickFields } = require("../utils/util");

//Services
const productService = require("./products.service");
const partnerService = require("./partner.service");
const attachmentService = require("./attachements.service");
const { journalService } = require("./journal.service");
const { nextPymeService } = require("./nextPyme.service");

//Repositories
const paramsTypeDocumentRepository = require("../Repository/params_type_document/params_type_document.repository");
const paramsTypeDocumentIdentificationRepository = require("../Repository/params_type_document_identification.repository/params_type_document_identification.repository");
const paramsMunicipalitiesRepository = require("../Repository/params_municipalities/params_municipalities.repository");
const paramsPaymentMethodsRepository = require("../Repository/params_payment_methods/params_payment_methods.repository");
const paramsLiabilitiesRepository = require("../Repository/param_type_liabilities/param_type_liabilities.repository");
const { getUnitMeasureByCode } = require("../Repository/param_unit_measures/params_unit_measures");
const { getTaxByCode } = require("../Repository/param_taxes/params_unit_measures");



const billService = {
    /**
     * Obtener la lista de facturas (account.move) desde Odoo.
     *
     * @async
     * @param {string[]} [billFields] - Campos a solicitar por factura.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de facturas) o error.
     */
    async getBills(billFields = ["name", "invoice_partner_display_name", "invoice_date", "invoice_date_due", "ref", "amount_untaxed_in_currency_signed", "state"]) {
        try {
            //Obtenemos todas las facturas
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "search_read",
                {
                    fields: billFields,
                }
            );

            ///Si hay algun error lo gestionamos
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

            //Regresamos la información de la consulta
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
    /**
     * Obtener una factura por su ID.
     *
     * @async
     * @param {number|string} id - ID de la factura (account.move).
     * @param {Array} [domain=[]] - Dominio adicional para filtrar la búsqueda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle de la factura) o error.
     */
    async getOneBill(id, domain = []) {
        try {
            //Obtenemos la factura por id
            const domainFinal = [['id', '=', Number(id)], ...domain];
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "search_read",
                {
                    domain: domainFinal,
                    limit: 1,
                }
            );

            //Si hay algun error lo gestionamos
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

            //Si no encontramos la factura regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: "Factura no encontrada" };
            }

            //Regresamos la información de la consulta
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
    /**
     * Crear una factura (account.move) en Odoo.
     *
     * Valida que el partner exista (si viene en el body), filtra campos permitidos y verifica
     * que los productos indicados existan antes de construir las líneas.
     *
     * @async
     * @param {Object} dataBill - Objeto con los campos de la factura. Se filtra con BILL_FIELDS.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta) o error.
     */
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

            //si tiene productos los verifico que existan y construyo las lineas
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
            //creo la factura
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "create",
                {
                    vals_list: [bill],
                }
            );

            //Si hay algun error lo gestionamos
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

            //Regresamos la respuesta de la creación
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
    /**
     * Actualizar una factura existente.
     *
     * action puede ser:
     * - 'replace': reemplazar todas las líneas por las nuevas proporcionadas.
     * - 'update': actualizar las líneas existentes (se validan tamaños y productos).
     *
     * @async
     * @param {number|string} id - ID de la factura a actualizar.
     * @param {Object} dataBill - Campos a actualizar (se filtran con BILL_FIELDS).
     * @param {string} [action='replace'] - Modo de actualización de líneas ('replace'|'update').
     * @returns {Promise<Object>} Resultado con statusCode, message y data (factura actualizada) o error.
     */
    async updateBill(id, dataBill, action = 'replace') {
        try {

            //Verificamos que la factura exista
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
            let linesToAdd = [];
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
                    linesToAdd = dataBill.invoice_line_ids.filter((line) =>
                        productResponse.data.foundIds.includes(Number(line.product_id))
                    );
                }
                if (action === 'replace') {
                    //construyo las lineas que deben ir en el body para construir
                    const productsFound = linesToAdd.map((line) => [0, 0, pickFields(line, INVOICE_LINE_FIELDS)]);
                    bill.invoice_line_ids = productsFound;
                    if (lineIds.length > 0) {
                        const deleted = await this.updateBillLines(id, 2, lineIds);
                        if (deleted.statusCode !== 200) {
                            return deleted;
                        }
                    }
                } else if (action === 'update') {
                    //si viene update ceirfico el tamaño de las linas y las actualizo
                    
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

            //Si hay algun error lo gestionamos
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
    /**
     * Verifica la consistencia de las líneas de una factura y actualiza su contenido.
     * Comprueba que exista la factura, que la cantidad de líneas coincida y que los productos sean válidos.
     *
     * @async
     * @param {number|string} id - ID de la factura.
     * @param {Array<Object>} lines - Array de objetos con los campos de las líneas a validar/actualizar.
     * @returns {Promise<Object>} Resultado con statusCode y message o error.
     */
    async verifyBillLines(id, lines) {
        try {
            console.log(lines, "Estas son las lineas que llegan");
            //Verificamos que la factura exista
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }
            console.log(billExists, "Factura verificada");
            //Verificamos que la cantidad de lineas coincida y que los productos sean válidos
            const lineIds = billExists.data.invoice_line_ids;
            if (lines.length !== lineIds.length || lines.length === 0) {
                return {
                    statusCode: 400,
                    message: "La cantidad de lineas no coincide con las existentes",
                };
            }
            console.log(lines.map((line) => line.product_id), "Estos son los IDs de los productos");
            const productsIds = await productService.validListId(lines.map((line) => line.product_id));
            if (productsIds.statusCode !== 200 || productsIds.data.foundIds.length !== lines.length) {
                return {
                    statusCode: 400,
                    message: "Los productos no son válidos",
                };
            }
            console.log(productsIds, "Productos verificados");
            //Actualizamos las lineas de la factura
            const response = await this.updateBillLines(id, 1, lines);
            if (response.statusCode !== 200) {
                return response;
            }

            //Regresamos el resultado
            return {
                statusCode: 200,
                message: "Líneas de factura actualizadas con éxito",
                data: response.data,
            };

        } catch (error) {

        }
    },
    /**
     * Eliminar una factura por ID.
     *
     * @async
     * @param {number|string} id - ID de la factura a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode y message o error.
     */
    async deleteBill(id) {
        try {
            //Verificamos que la factura exista
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            //Eliminamos la factura
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "unlink",
                {
                    ids: [Number(id)],
                }
            );

            //Si hay algun error lo gestionamos
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

            //Regresamos la información de la consulta
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
    /**
     * Confirmar (postear) una factura. Realiza la acción `action_post` en Odoo.
     *
     * @async
     * @param {number|string} id - ID de la factura a confirmar.
     * @param {string} [action='compra'] - Etiqueta opcional para el flujo (no usada en la llamada a Odoo).
     * @returns {Promise<Object>} Resultado con statusCode y message o error.
     */
    async confirmBill(id, action = 'compra') {
        try {
            //verifico que la factura exista y no este confirmada
            const billExists = await this.getOneBill(id, [['state', '!=', 'posted']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message + " o ya está confirmada",
                    data: billExists.data,
                };
            }

            //confirmo la factura
            const response = await odooConector.executeOdooRequest(
                "account.move",
                "action_post",
                {
                    ids: [Number(id)],
                }
            );

            //Si hay algun error lo gestionamos
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

            //Regreso la factura confirmada
            return {
                statusCode: 200,
                message: "Factura confirmada con éxito",
                data: response.data
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
    /**
     * Confirmar una nota de crédito: verifica, confirma y sincroniza con DIAN.
     *
     * @async
     * @param {number|string} id - ID de la nota de crédito (account.move).
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async confirmCreditNote(id) {
        try {

            //verifico que la nota de credito exista y no este confirmada
            const billExists = await this.getOneBill(id, [['state', '!=', 'posted']]);
            if (billExists.statusCode !== 200) return billExists

            //confirmo la nota de credito
            const bill = await this.confirmBill(id);
            if (bill.statusCode !== 200) return bill;

            //sincronizo con la dian
            const responseDian = await this.syncDian(id);
            if (responseDian.statusCode !== 200) return responseDian;

            //subo los archivos de la dian a ODOO
            const uploadFiles = await this.uploadFilesFromDian(id, responseDian.data);
            if (uploadFiles.statusCode !== 200) return uploadFiles;

            //Regreso la nota de credito confirmada y sincronizada
            return {
                statusCode: 200,
                message: "Nota de crédito confirmada con éxito",
                data: uploadFiles.data
            }

        } catch (error) {
            console.log("Error en billService.confirmCreditNote:", error);
            return {
                statusCode: 500,
                message: "Error al confirmar nota de crédito",
                error: error.message,
            };
        }
    },

    async SyncAndUpdateBillsDian(id) {
        try {

            //verifico que la nota de credito exista y no este confirmada
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) return billExists

            //si no esta confirmada la confirmo
            if (billExists.data.state !== 'posted') {

                const bill = await this.confirmBill(id);
                if (bill.statusCode !== 200) return bill;

            }

            //sincronizo con la dian
            const responseDian = await this.syncDian(id);
            if (responseDian.statusCode !== 200) return responseDian;
            console.log("Respuesta DIAN:", responseDian);
            //subo los archivos de la dian a ODOO
            const uploadFiles = await this.uploadFilesFromDian(id, responseDian.data);
            if (uploadFiles.statusCode !== 200) return uploadFiles;

            return {
                statusCode: 200,
                message: "Nota de crédito confirmada con éxito",
                data: uploadFiles.data
            }

        } catch (error) {
            console.log("Error en billService.confirmCreditNote:", error);
            return {
                statusCode: 500,
                message: "Error al confirmar nota de crédito",
                error: error.message,
            };
        }
    },

    /**
     * Reestablecer una factura a borrador.
     *
     * @async
     * @param {number|string} id - ID de la factura.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async resetToDraftBill(id) {
        try {

            //verifico que la factura exista y no este en borrador
            const billExists = await this.getOneBill(id, [['state', '!=', 'draft']]);
            if (billExists.statusCode !== 200) {
                return {
                    statusCode: billExists.statusCode,
                    message: billExists.message,
                    data: billExists.data,
                };
            }

            //reestablezco la factura a borrador
            const response = await odooConector.executeOdooRequest(
                "account.move",
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

            //Regreso la respuesta de la consulta
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
    /**
     * Crear una nota de débito a partir de una factura confirmada.
     *
     * @async
     * @param {number|string} id - ID de la factura origen (debe estar en estado 'posted').
     * @param {Object} dataDebit - Parámetros para la nota de débito (reason, date, journal_id, etc.).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (nota creada) o error.
     */
    async createDebitNote(id, dataDebit) {
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

            // Crear el wizard de nota de débito
            const wizardData = {
                move_ids: [[6, 0, [Number(id)]]],
                reason: dataDebit.reason || "Nota de débito",
                date: dataDebit.date || new Date().toISOString().split("T")[0],
                journal_id: dataDebit.journal_id || false,
                l10n_co_edi_description_code_debit: dataDebit.l10n_co_edi_description_code_debit || "1",
            };

            // Creo el wizard de nota de débito
            const wizardResponse = await odooConector.executeOdooRequest(
                "account.debit.note",
                "create",
                {
                    vals_list: [wizardData],
                }
            );
            if (wizardResponse.error) return { statusCode: 500, message: "Error al crear wizard de nota de débito", error: wizardResponse.message };
            if (!wizardResponse.success) {
                return {
                    statusCode: 400,
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

            //Actualizar tipo de documento de la nota de debito
            const debitNoteId = debitNoteResponse.data.res_id;
            await this.updateBill(debitNoteId, { l10n_co_edi_type: "92" }, 'update');

            //Regreso la nota debito creada
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
    /**
     * Crear una nota de crédito a partir de una factura confirmada.
     *
     * @async
     * @param {number|string} id - ID de la factura origen (debe estar en estado 'posted').
     * @param {Object} dataCredit - Parámetros para la nota de crédito (date, journal_id, etc.).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (nota creada) o error.
     */
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

            //Creo el wizard de nota de credito
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
            if (creditNoteResponse.error) return { statusCode: 500, message: "Error al crear nota de crédito", error: creditNoteResponse.message };
            if (!creditNoteResponse.success) {
                return {
                    statusCode: 500,
                    message: "Error al crear nota de crédito",
                    error: creditNoteResponse.message,
                };
            }


            //Ahora actualizamos la informacion de la nota credito con los datos y productos de la factura original

            //Consigo las lineas de la factura original
            const creditNoteId = creditNoteResponse.data.res_id;
            const lines = await this.getLinesByBillId(id);
            if (lines.statusCode !== 200) {
                return lines;
            }

            //Actualizo los productos y los datos de la factura en la nota credito
            const updatedCreditNote = await this.updateBill(creditNoteId, {
                //Datos de la factura
                l10n_co_edi_payment_option_id: billExists.data.l10n_co_edi_payment_option_id?.[0],
                invoice_payment_term_id: billExists.data.invoice_payment_term_id?.[0],
                invoice_date: billExists.data.invoice_date,
                //Productos
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
    /**
     * Crear un pago para una factura confirmada mediante el asistente `account.payment.register`.
     *
     * @async
     * @param {number|string} invoiceId - ID de la factura (debe estar en estado 'posted').
     * @param {Object} paymentDatas - Datos del pago (amount, date, journal_id, payment_method_line_id, memo).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (info del pago) o error.
     */
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

            // Crear el wizard con la estructura correcta
            const wizardCreate = await odooConector.executeOdooRequest(
                'account.payment.register',
                'create',
                {
                    vals_list: wizardData,
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

            if (payment.error) return { statusCode: 500, message: "Error al crear el pago", error: payment.message };
            if (!payment.success) {
                return {
                    statusCode: 400,
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
    /**
     * Listar notas de crédito pendientes aplicables a una factura (widget `invoice_outstanding_credits_debits_widget`).
     *
     * @async
     * @param {number|string} invoiceId - ID de la factura.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de créditos) o error.
     */
    async listOutstandingCredits(invoiceId) {
        try {
            // Verificar que la factura exista y esté confirmada
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

            //Regreso la información de las notas de crédito pendientes
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
    /**
     * Aplicar una nota de crédito pendiente a una factura (js_assign_outstanding_line en Odoo).
     *
     * @async
     * @param {number|string} invoiceId - ID de la factura destino.
     * @param {number|string} creditMoveId - ID de la nota de crédito a aplicar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async applyCreditNote(invoiceId, creditMoveId) {
        try {
            //Consultar notas de credito del cliente
            const outstandingCredits = await this.listOutstandingCredits(invoiceId);
            const creditToApply = outstandingCredits.data.find(credit => credit.id === creditMoveId);

            //Si no hay notas de credito pendientes regresamos 404
            if (!creditToApply) {
                return {
                    statusCode: 404,
                    message: "La nota de crédito no se encuentra entre las pendientes",
                    data: null
                };
            }

            //aplicar la nota de credito a la factura
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

            //Regreso la información de la consulta
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
    /**
     * Actualizar las líneas de una factura con comandos Odoo (1,2,3,5,6...): actualizar, eliminar, desconectar, etc.
     *
     * @async
     * @param {number|string} id - ID de la factura.
     * @param {number} action - Código de acción (1 actualizar, 2 eliminar, 3 desconectar, 5 eliminar todas, 6 reemplazar, ...).
     * @param {Array} lines - IDs o estructuras necesarias según la acción.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
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

            //actualizamos las lineas de la orden de compra
            const response = await odooConector.executeOdooRequest("account.move", "write", {
                ids: [Number(id)],
                vals: {
                    invoice_line_ids: actions
                }
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar líneas de orden de compra', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar líneas de orden de compra', data: response.data };
            }

            //Regreso la información de la consulta
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
     * Obtener líneas (account.move.line) de una factura por su ID.
     *
     * @async
     * @param {number|string} id - ID de la factura.
     * @param {string} [action='id'] - 'id' para retornar solo product_id como id, 'full' para retornar todo.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de líneas) o error.
     */
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

    /**
     * Construye el payload (JSON) requerido por DIAN/NextPyme a partir de una factura (account.move) ya posteada.
     * Toma datos del cliente, forma de pago, resolución DIAN, líneas, impuestos y totales, ajustando la estructura
     * según el tipo de documento (factura, nota débito o nota crédito).
     *
     * Notas:
     * - La factura debe estar en estado 'posted'.
     * - Consulta múltiples modelos en Odoo (account.move, res.partner, res.city, uom.uom, account.tax, l10n_co_edi.*)
     *   y tablas de parámetros locales (tipos de documento, unidades de medida, impuestos, responsabilidades, etc.).
     *
     * @async
     * @function createJsonDian
     * @param {number|string} billId ID de la factura (account.move) en Odoo.
     * @returns {Promise<{statusCode:number, message:string, data?:Record<string, any>, error?:string}>}
     *          Objeto resultado. En éxito incluye en data el JSON listo para envío a DIAN.
     *          En error retorna un statusCode, message y opcionalmente error con el detalle.
     *
     * @example
     * // Crear el JSON DIAN de la factura 123
     * const res = await billService.createJsonDian(123);
     * if (res.statusCode === 200) {
     *   // res.data contiene el JSON para DIAN
     * }
     */
    async syncDian(id) {
        try {
            //obtenemos el json para enviar a la dian
            const jsonDian = await this.createJsonDian(Number(id));
            if (jsonDian.statusCode !== 200) return jsonDian;
            let dianResponse;
            //Si es factura de venta
            if (jsonDian.data.type_document_id === 1){
                dianResponse = await nextPymeConnection.nextPymeService.sendInvoiceToDian(jsonDian.data);
                const billUpdate = await this.updateBill(id, { l10n_co_edi_cufe_cude_ref: dianResponse.data.cufe, x_studio_uuid_dian: dianResponse.data.uuid_dian }, 'update');
            }

            //Si es nota credito
            if (jsonDian.data.type_document_id === 4){
                dianResponse = await nextPymeConnection.nextPymeService.sendCreditNoteToDian(jsonDian.data);
                const billUpdate = await this.updateBill(id, { l10n_co_edi_cufe_cude_ref: dianResponse.data.cude, x_studio_uuid_dian: dianResponse.data.uuid_dian }, 'update');
            } 

            //Si es nota debito
            if (jsonDian.data.type_document_id === 5){
                dianResponse = await nextPymeConnection.nextPymeService.sendDebitNoteToDian(jsonDian.data);
                console.log(dianResponse.data);
                const billUpdate = await this.updateBill(id, { l10n_co_edi_cufe_cude_ref: dianResponse.data.cude, x_studio_uuid_dian: dianResponse.data.uuid_dian }, 'update');
            } 

            if (dianResponse.statusCode !== 200) return dianResponse;

            return { statusCode: 200, message: "Factura sincronizada con éxito", data: dianResponse.data };
        } catch (error) {
            console.log("Error en billService.syncDian:", error);
            return {
                statusCode: 500,
                message: "Error al sincronizar con la DIAN",
                error: error.message,
            };
        }


    },

    /**
     * Sube a Odoo los archivos de la DIAN (PDF, XML y ZIP) como adjuntos de una factura.
     * - Descarga el PDF y el ZIP desde NextPyme.
     * - Adjunta el XML usando el contenido incluido en `dianResponse`.
     *
     * Nota: Este método asume que `nextPymeService.getPdfInvoiceFromDian` y
     * `nextPymeService.getXmlZipFromDian` retornan un objeto con `statusCode`
     * y `data` (Buffer binario en `data`).
     *
     * @async
     * @function uploadFilesFromDian
     * @param {number|string} id ID de la factura en Odoo (account.move) a la que se adjuntarán los archivos.
     * @param {{ urlinvoicepdf: string, urlinvoicexml: string, invoicexml?: Buffer|string }} dianResponse
     *        Respuesta de NextPyme con las URLs del PDF y XML, y el contenido XML opcional en `invoicexml`.
     * @returns {Promise<{statusCode:number, message:string, data?:{updatedBill:any, updatedBillS:any, updatedBillSZIP:any}, error?:string}>}
     *          Resultado de la operación. En éxito incluye los IDs/valores devueltos por Odoo al crear los adjuntos.
     *          En error retorna `statusCode` y `error` descriptivo.
     *
     * @example
     * // Adjuntar archivos DIAN a la factura 123
     * await billService.uploadFilesFromDian(
     *   123,
     *   { urlinvoicepdf: 'ubl2.1/download/900731971/FACT-001.pdf', urlinvoicexml: 'ubl2.1/download/900731971/FACT-001.xml', invoicexml: '<Invoice>...</Invoice>' },
     * );
     */
    async uploadFilesFromDian(id, dianResponse) {
        try {
            // obtener el pdf y zip archivos desde nextPyme
            const pdf = dianResponse.urlinvoicepdf;
            const pdfFile = await nextPymeService.getPdfInvoiceFromDian(pdf);

            //Si la respuesta  de la dian trae el .zip en base64 se le asigna, si no se busca
            dianResponse.attacheddocument = (await nextPymeService.getXmlZipFromDian(dianResponse.urlinvoicexml.split('-')[1])).data;
            if (pdfFile.statusCode !== 200) return pdfFile;

            //subimos los archivos a la factura de odoo
            const updatedBill = await attachmentService.createAttachement("account.move", Number(id), { originalname: dianResponse.urlinvoicepdf, buffer: pdfFile.data });
            if (updatedBill.statusCode !== 201) return updatedBill;

            const updatedBillS = await attachmentService.createAttachementXML("account.move", Number(id), { originalname: dianResponse.urlinvoicexml, buffer: dianResponse.invoicexml });
            if (updatedBillS.statusCode !== 201) return updatedBillS;

            const updatedBillSZIP = await attachmentService.createAttachementZIP("account.move", Number(id), { originalname: dianResponse.urlinvoicepdf.split('.')[0] + ".zip", buffer: dianResponse.attacheddocument.filebase64 });
            if (updatedBillSZIP.statusCode !== 201) return updatedBillSZIP;

            return { statusCode: 200, message: 'Archivos obtenidos', data: { updatedBill, updatedBillS, updatedBillSZIP } };

        }
        catch (error) {
            console.error('Error al subir los archivos a la factura en Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al subir los archivos a la factura en Odoo',
                error: error.message
            };
        }
    },

    /**
     * Construye el payload (JSON) requerido por DIAN/NextPyme a partir de una factura (account.move) ya posteada.
     * Toma datos del cliente, forma de pago, resolución DIAN, líneas, impuestos y totales, ajustando la estructura
     * según el tipo de documento (factura, nota débito o nota crédito).
     *
     * Notas:
     * - La factura debe estar en estado 'posted'.
     * - Consulta múltiples modelos en Odoo (account.move, res.partner, res.city, uom.uom, account.tax, l10n_co_edi.*)
     *   y tablas de parámetros locales (tipos de documento, unidades de medida, impuestos, responsabilidades, etc.).
     *
     * @async
     * @function createJsonDian
     * @param {number|string} billId ID de la factura (account.move) en Odoo.
     * @returns {Promise<{statusCode:number, message:string, data?:Record<string, any>, error?:string}>}
     *          Objeto resultado. En éxito incluye en data el JSON listo para envío a DIAN.
     *          En error retorna un statusCode, message y opcionalmente error con el detalle.
     *
     * @example
     * // Crear el JSON DIAN de la factura 123
     * const res = await billService.createJsonDian(123);
     * if (res.statusCode === 200) {
     *   // res.data contiene el JSON para DIAN
     * }
     */
    async createJsonDian(billId) {
        try {
            const jsonDian = { ...dianRequest };

            //Obtengo todos los datos de la factura
            const bill = await this.getOneBill(billId, [['state', '=', 'posted']]); //Solo facturas confirmadas y firmadas
            if (bill.statusCode !== 200) return bill;

            let billReference = null;
            //si tiene una factura de referencia la obtengo
            if (bill.data.reversed_entry_id && bill.data.reversed_entry_id[0]) {
                billReference = await this.getOneBill(bill.data.reversed_entry_id[0]);
                if (billReference.statusCode !== 200) return billReference;
            }

            //Si es una nota de debito obtengo la factura de origen
            let debitOrigin = null;
            if (bill.data.debit_origin_id && bill.data.debit_origin_id[0]) {
                debitOrigin = await this.getOneBill(Number(bill.data.debit_origin_id[0]));
                if (debitOrigin.statusCode !== 200) return debitOrigin;
            }

            //Fecha y hora de la factura
            const post_time = bill.data.l10n_co_dian_post_time.split(' ');
            const date = post_time[0];//
            const time = post_time[1];//

            //consecutivo y prefix de la factura
            const bill_name = bill.data.name.split('/');
            const number = bill_name[2];//
            const prefix = bill_name[0];//

            //tipo de documento de la factura, nota credito o nota debito
            const move_type = bill.data.l10n_co_edi_type;
            const { data } = await paramsTypeDocumentRepository.getTypeDocumentByCode(move_type);
            if (data.length < 1) return { statusCode: 404, message: "El tipo de documento no está configurado en la tabla de parámetros" };
            const type_document_id = data[0]; //

            // //Obtengo los datos del cliente
            const bill_customer = await partnerService.getOnePartner(bill.data.partner_id[0]);
            let customer = {}; //

            //sendEmail
            const sendEmail = bill_customer.data.followup_reminder_type === "automatic";

            //tipo de documento de identificacion
            const customer_l10n_latam_identification_type_id = bill_customer.data.l10n_latam_identification_type_id;
            const type_document_identification_id = await paramsTypeDocumentIdentificationRepository.getTypeDocumentByCode(customer_l10n_latam_identification_type_id[0]);
            if (type_document_identification_id.data.length < 1) return { statusCode: 404, message: "El tipo de documento de identificación no está configurado en la tabla de parámetros" };
            customer.type_document_identification_id = type_document_identification_id.data[0].id;

            //documento del cliente
            const vat = bill_customer.data.vat.split('-');
            customer.identification_number = vat[0];
            if (type_document_identification_id.data[0].id == 6) customer.dv = vat[1];

            //nombre, telefono, direccion y email del cliente
            if (!bill_customer.data.name) return { statusCode: 400, message: "El cliente no tiene nombre", data: [] };
            if (!bill_customer.data.phone) return { statusCode: 400, message: "El cliente no tiene teléfono", data: [] };
            if (!bill_customer.data.email) return { statusCode: 400, message: "El cliente no tiene email", data: [] };
            if (!bill_customer.data.street && !bill_customer.data.street2) return { statusCode: 400, message: "El cliente no tiene dirección", data: [] };

            customer.name = bill_customer.data.name;
            customer.phone = bill_customer.data.phone;
            customer.email = bill_customer.data.email;
            customer.address = bill_customer.data.street || bill_customer.data.street2;

            //registro mercantil
            customer.merchant_registration = bill_customer.data.x_studio_registro_mercantil || "0000000";

            //tipo de organizacion
            customer.type_organization_id = bill_customer.data.is_company ? 1 : 2;

            //municipio
            const city = await odooConector.executeOdooRequest("res.city", "search_read", { domain: [['id', '=', bill_customer.data.city_id[0]]] });
            if (city.error) return { statusCode: 500, message: "Error al obtener el municipio del cliente", error: city.message };
            if (!city.success) return { statusCode: 400, message: "Error al obtener el municipio del cliente", data: city.data };
            if (city.data.length === 0) return { statusCode: 404, message: "El cliente no tiene municipio o el municipio no existe" };

            const municipality_id = (await paramsMunicipalitiesRepository.getMunicipalityByCode(city.data[0].l10n_co_edi_code)).data[0].id
            if (!municipality_id) return { statusCode: 404, message: "El municipio no está configurado en la tabla de parámetros" };
            customer.municipality_id = municipality_id;

            //tipo de regimen
            const fiscal_regimen = bill_customer.data.l10n_co_edi_fiscal_regimen;
            if(!fiscal_regimen) return { statusCode: 400, message: "El cliente no tiene régimen fiscal", data: [] };
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
            if (!payment_id) return { statusCode: 400, message: "La factura no tiene método de pago" };
            const payment_method = (await odooConector.executeOdooRequest("l10n_co_edi.payment.option", "search_read", { domain: [['id', '=', payment_id]] }));

            const payment_method_id = (await paramsPaymentMethodsRepository.getPaymentMethodByCode(payment_method.data[0].code));
            if (payment_method_id.data.length < 1) return { statusCode: 404, message: "El método de pago no está configurado en la tabla de parámetros" };
            payment_form.payment_method_id = payment_method_id.data[0].id;

            //Notas de la factura
            const notes = bill.data.x_studio_notas || "";
            //fecha de pago
            payment_form.payment_due_date = bill.data.invoice_date_due;

            //Duracion del pago (Calculado en dias dependiendo la fecha de la factura y la feca del pago)
            const invoice_date = new Date(bill.data.invoice_date);
            const invoice_date_due = new Date(bill.data.invoice_date_due);

            //Calculo la diferencia en milisegundos
            const diferenciaMs = invoice_date_due - invoice_date;
            const dias = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));
            payment_form.duration_measure = dias;

            //Numero de resolucion de la factura
            const journalData = await journalService.getOneJournal(bill.data.journal_id[0]);
            if (journalData.statusCode !== 200) return journalData;
            if (!journalData.data.l10n_co_edi_dian_authorization_number) return { statusCode: 400, message: "El diario no tiene configurado un  número de resolución DIAN" };
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
                if (unitMeassure.error) return { statusCode: 500, message: "Error al obtener la unidad de medida", error: unitMeassure.message };
                if (!unitMeassure.success) return { statusCode: 400, message: "Error al obtener la unidad de medida", data: unitMeassure.data };
                if (unitMeassure.data.length === 0) return { statusCode: 404, message: `La unidad de medida ${line.product_uom_id[0]} de la linea ${line.id} no existe` };

                const identificador = unitMeassure.data[0].l10n_co_edi_ubl;
                //busco la unidad de medida en la tabla de parametros
                const unit_measure_id = await getUnitMeasureByCode(identificador);
                if (unit_measure_id.data.length === 0) return { statusCode: 404, message: `La unidad de medida con código ${identificador} no está configurada en la tabla de parámetros` };

                let lines2 = {};

                lines2.code = String(line.product_id[0]);
                lines2.notes = line.name || "";
                lines2.description = line.product_id[1];
                lines2.price_amount = line.price_total;
                lines2.base_quantity = line.quantity;
                lines2.unit_measure_id = Number(unit_measure_id.data[0].id);
                lines2.invoiced_quantity = line.quantity;
                lines2.line_extension_amount = line.price_subtotal;
                lines2.free_of_charge_indicator = false; //de donde saco esto
                lines2.type_item_identification_id = 4; //Esteban me dijo que siempre es 4
                if (bill.data.l10n_co_edi_operation_type === '12' || (billReference && billReference.data && billReference.data.l10n_co_edi_operation_type === '12') || (debitOrigin && debitOrigin.data && debitOrigin.data.l10n_co_edi_operation_type === '12')) {
                    lines2.is_RNDC = true;
                    if (!line.x_studio_rad_rndc) return { statusCode: 400, message: `La linea ${line.id} no tiene número de radicado RNDC` };
                    if (!line.x_studio_n_remesa) return { statusCode: 400, message: `La linea ${line.id} no tiene número de remesa interna` };
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

                    if (taxData.error) return { statusCode: 500, message: `Error al obtener el impuesto ${tax} de la linea ${line.id}`, error: taxData.message };
                    if (!taxData.success) return { statusCode: 400, message: `Error al obtener el impuesto ${tax} de la linea ${line.id}`, data: taxData.data };
                    if (taxData?.data.length === 0) return { statusCode: 404, message: `El impuesto ${tax} de la linea ${line.id} no existe` };

                    const taxTypeData = await odooConector.executeOdooRequest("l10n_co_edi.tax.type", "search_read", { domain: [['id', '=', taxData.data[0].l10n_co_edi_type[0]]] });
                    if (taxTypeData.error) return { statusCode: 500, message: `Error al obtener el tipo de impuesto ${taxData.data[0].l10n_co_edi_type[0]} del impuesto ${tax} de la linea ${line.id}`, error: taxTypeData.message };
                    if (!taxTypeData.success) return { statusCode: 400, message: `Error al obtener el tipo de impuesto ${taxData.data[0].l10n_co_edi_type[0]} del impuesto ${tax} de la linea ${line.id}`, data: taxTypeData.data };
                    if (taxTypeData.data.length === 0) return { statusCode: 404, message: `El tipo de impuesto ${taxData.data[0].l10n_co_edi_type[0]} del impuesto ${tax} de la linea ${line.id} no existe` };

                    const tax_id = await getTaxByCode(taxTypeData.data[0].code);
                    if (tax_id.data[0].length === 0) return { statusCode: 404, message: `El tipo de impuesto con código ${taxTypeData.data[0].code} no está configurado en la tabla de parámetros` };

                    tax_line.tax_id = tax_id.data[0].id;
                    tax_line.tax_amount = taxData.data[0].amount === 0 ? 0 : line.price_subtotal * (taxData.data[0].amount / 100);
                    tax_line.percent = taxData.data[0].amount;
                    tax_line.taxable_amount = line.price_subtotal;


                    tax_totals.push({ ...tax_line });

                    //Taxt toal pero de la las lineas
                    //Verificamos si ya evaluamos el tipo de impuesto
                    if (tax_totals_map.has(tax)) {
                        // Si ya lo pasamos sumamos el valor del impuesto y el valor de la base gravable
                        const existing = tax_totals_map.get(tax);
                        existing.tax_amount += tax_line.tax_amount;
                        existing.taxable_amount += tax_line.taxable_amount;
                        tax_totals_map.set(tax, existing);
                    } else {
                        // Registramos el impuesto por primera vez
                        tax_totals_map.set(tax, {
                            tax_id: tax_line.tax_id,
                            tax_amount: tax_line.tax_amount,
                            percent: tax_line.percent,
                            taxable_amount: tax_line.taxable_amount
                        });
                    }

                }
                lines2.tax_totals = tax_totals;
                linesProduct.push(lines2);
            }

            let tax_exclusive_amount = 0;
            tax_totals_map.forEach((valor, clave) => {
                tax_totals_bill.push(valor);
                tax_exclusive_amount += valor.taxable_amount;
            })

            // totales de la factura
            const legal_monetary_totals = {
                payable_amount: bill.data.amount_total,
                tax_exclusive_amount: tax_exclusive_amount,
                tax_inclusive_amount: bill.data.amount_total,
                line_extension_amount: bill.data.amount_untaxed,
                allowance_total_amount: 0.00,
                charge_total_amount: 0.00,
            }


            //construyo el json para la dian
            //Campos generales de las facturas, notas credito y notas debito
            jsonDian.type_document_id = type_document_id.id;
            jsonDian.tax_totals = tax_totals_bill;
            jsonDian.sendmail = sendEmail;
            jsonDian.notes = notes;
            jsonDian.payment_form = payment_form;
            jsonDian.date = date;
            jsonDian.time = time;
            jsonDian.number = number;
            if (type_document_id.id !== 5) jsonDian.prefix = prefix;
            jsonDian.customer = customer;

            //Campos específicos segun el tipo de documento
            if (type_document_id.id == 1) {
                //Campos de factura de venta
                jsonDian.invoice_lines = linesProduct;
                jsonDian.legal_monetary_totals = legal_monetary_totals;
                jsonDian.resolution_number = resolution_number;

            } else if (type_document_id.id == 5) {
                //Campos de nota debito
                jsonDian.number = Number(jsonDian.number);
                jsonDian.debit_note_lines = linesProduct;
                jsonDian.discrepancyresponsecode = bill.data.l10n_co_edi_description_code_debit;
                jsonDian.discrepancynotes = (bill.data.ref.split(', ')[1]);
                jsonDian.requested_monetary_totals = legal_monetary_totals;

                //Factura de origen de la cual se realizo la nota debito
                const getBillReference = await this.getOneBill(Number(bill.data.debit_origin_id[0]));
                if (getBillReference.statusCode !== 200) return getBillReference;

                const billing_reference = {
                    number: getBillReference.data.name.split('/')[2],
                    uuid: getBillReference.data.x_studio_uuid_dian,
                    issue_date: getBillReference.data.invoice_date
                };

                jsonDian.billing_reference = billing_reference;
            } else {
                //Campos de nota credito
                jsonDian.number = Number(jsonDian.number)
                jsonDian.credit_note_lines = linesProduct;
                jsonDian.discrepancyresponsecode = bill.data.l10n_co_edi_description_code_credit;
                jsonDian.discrepancynotes = (bill.data.ref.split(', ')[1]);
                jsonDian.legal_monetary_totals = legal_monetary_totals;

                //Factura de origen de la cual se realizo la nota credito
                const getBillReference = await this.getOneBill(Number(bill.data.reversed_entry_id[0]));
                if (getBillReference.statusCode !== 200) return getBillReference;

                const billing_reference = {
                    number: getBillReference.data.name.split('/')[2],
                    uuid: getBillReference.data.l10n_co_edi_cufe_cude_ref,
                    issue_date: getBillReference.data.invoice_date
                };

                jsonDian.billing_reference = billing_reference;
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

    },

    async getSaleOrdersByBillId(id) {
        try {
            //verifico que la factura exista
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) return billExists;

            //obtengo las ordenes de compra relacionadas
            let saleOrdersIds = await odooConector.executeOdooRequest('account.move', 'action_view_source_sale_orders', { ids: [id] });
            if (saleOrdersIds.error) {
                return {
                    statusCode: 500,
                    message: "Error al obtener órdenes de venta",
                    error: saleOrdersIds.message,
                };
            }
            if (!saleOrdersIds.success) {
                return {
                    statusCode: 400,
                    message: "Error al obtener órdenes de compra",
                    data: purchaseOrdersIds.data,
                };
            }
            saleOrdersIds = saleOrdersIds.data;
            console.log(saleOrdersIds, "Estas son las órdenes de venta relacionadas");
            //Si solo tiene una orden de venta relacionada
            if (saleOrdersIds.res_id) saleOrdersIds = [saleOrdersIds.res_id];
            else saleOrdersIds = saleOrdersIds.domain[0][2];

            //Obtengo los datos de las ordenes de venta
            const saleOrders = await odooConector.executeOdooRequest('sale.order', 'search_read', {
                domain: [['id', 'in', saleOrdersIds]],
                fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'order_line'],
            });

            return { statusCode: 200, message: "Órdenes de venta relacionadas", data: saleOrders.data };


        } catch (error) {
            console.log("Error al obtener las órdenes de venta:", error);
            return {
                statusCode: 500,
                message: "Error al obtener órdenes de venta",
                error: error.message,
            };
        }
    }
};

module.exports = billService;

const { success, json } = require('zod');
const odooConector = require('../utils/odoo.service');
const billService = require('./bills.service');
const { typeLiabilityService } = require('./liability.service');
const { municipalityService } = require('./municipality.service');
const partnerService = require('./partner.service');
const { paymentMethodService } = require('./paymentMethod.service');
const { documentPartnerService } = require('./documentPartner.service');
const { unitMeasureService } = require('./unitMeasure.service');
const { journalService } = require('./journal.service');
const util_date = require('../utils/date');
const { nextPymeService } = require('./nextPyme.service');
const { taxService } = require('./tax.service');

const supportDocumentService = {

    /**
     * Obtiene documentos de soporte (account.move) filtrados por diarios y tipo de movimiento.
     * Actualmente ignora el parámetro documentId y retorna la lista filtrada.
     *
     * @async
     * @param {number|string} [documentId] - (Opcional) ID del documento; no se utiliza en este método.
     * @returns {Promise<{statusCode:number, error:boolean, message:string, data:any[]}>}
     *  - 200: data con lista de movimientos.
     *  - 404: no se encontraron documentos.
     *  - 500: error interno.
     */
    async getSupportDocumentContent(documentId) {
        // Lógica para obtener el contenido del documento de soporte desde la base de datos
        try {
            const document = await billService.getBills([], [["journal_id", "in", [15, 16]], ["move_type", "in", ["in_invoice", "in_refund"]]]);
            if (document.statusCode !== 200) {
                return { statusCode: 404, error: true, message: 'Documento no encontrado', data: [] };
            }

            return { statusCode: 200, error: false, message: 'Documento obtenido con éxito', data: document.data };

        } catch (error) {
            console.error('Error al obtener el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Obtiene un documento de soporte por ID aplicando filtros adicionales.
     *
     * @async
     * @param {number|string} documentId - ID del account.move.
     * @param {Array} [domain=[]] - Condiciones adicionales en formato dominio Odoo.
     * @returns {Promise<{statusCode:number, error:boolean, message:string, data:any}>}
     *  - 200: data con el movimiento encontrado.
     *  - 404: no encontrado.
     *  - 500: error interno.
     */
    async getSupportDocumentContentById(documentId, domain = []) {
        // Lógica para obtener el contenido del documento de soporte desde la base de datos
        try {
            const document = await billService.getOneBill(documentId, [["journal_id", "in", [15, 16]], ["move_type", "in", ["in_invoice", "in_refund"]], ...domain]);
            if (document.statusCode !== 200) {
                return { statusCode: 404, error: true, message: 'Documento no encontrado', data: [] };
            }

            return { statusCode: 200, error: false, message: 'Documento obtenido con éxito', data: document.data };

        } catch (error) {
            console.error('Error al obtener el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Crea un documento de soporte (vendor bill) en Odoo forzando:
     * - move_type = 'in_invoice'
     * - journal_id = 15 (diario de documentos de soporte)
     *
     * @async
     * @param {Object} documentData - Valores para crear el account.move.
     * @returns {Promise<{statusCode:number, error:boolean, message:string, data:any}>}
     *  - 201: documento creado (data).
     *  - 400: error al crear.
     *  - 500: error interno.
     */
    async createSupportDocument(documentData) {
        // Lógica para crear un nuevo documento de soporte en la base de datos
        try {

            // Aquí iría la lógica para crear el documento
            const supportDocumentData = documentData;
            supportDocumentData.move_type = 'in_invoice';
            supportDocumentData.journal_id = 15; // ID del diario de documentos de soporte

            // Llama al servicio de facturas para crear el documento
            const supportDocument = await billService.createBill(supportDocumentData);
            if (supportDocument.statusCode !== 201) {
                return { statusCode: 400, error: true, message: 'Error al crear el documento de soporte', data: [] };
            }


            return { statusCode: 201, error: false, message: 'Documento creado con éxito', data: supportDocument.data };
        } catch (error) {
            console.error('Error al crear el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera la sección "seller" (proveedor) para el JSON de documento de soporte.
     * Valida campos obligatorios y DV según tipo de documento.
     *
     * @async
     * @param {{ data:Object }} customer - Partner de Odoo (res.partner) con sus campos en data.
     * @returns {Promise<{success:boolean, message:string, data:Object}>}
     *  - success true: data con seller completo.
     *  - success false: message con los campos faltantes.
     */
    async generate_json_support_document_seller(customer) {
        try {
            const city = await municipalityService.getMunicipalityCodeById(customer.data.city_id[0]);
            if (city.statusCode !== 200) return city;

            const typeLiability = await typeLiabilityService.getTypeLiabilityCodeById(customer.data.l10n_co_edi_obligation_type_ids[0]);
            if (typeLiability.statusCode !== 200) return typeLiability;

            const documentPartner = await documentPartnerService.getDocumentPartnerCodeById(customer.data.l10n_latam_identification_type_id[0]);
            if (documentPartner.statusCode !== 200) return documentPartner;

            if (documentPartner.data[0].id != '6' && !customer.data.vat.includes('-')) {
                return { success: false, message: 'El número de identificación del cliente no contiene dígito de verificación pero el tipo de documento requiere uno.', data: [] };
            }

            const seller = {
                identification_number: customer.data.vat.includes('-') ? customer.data.vat.split('-')[0] : customer.data.vat,
                name: customer.data.name,
                phone: customer.data.phone,
                address: customer.data.street,
                email: customer.data.email,
                merchant_registration: customer.data.x_studio_registro_mercantil ? customer.data.x_studio_registro_mercantil : '0000000',
                postal_zone_code: customer.data.zip,
                type_document_identification_id: documentPartner.data[0].id,
                type_organization_id: customer.data.is_company ? 1 : 2,
                type_liability_id: typeLiability.data[0].id,
            }

            if (customer.data.vat.includes('-') && documentPartner.data[0].id === 6) seller.dv = customer.data.vat.split('-')[1];
            if (city.data) seller.municipality_id = city.data[0].id;
            if (customer.data.l10n_co_edi_fiscal_regimen) seller.type_regime_id = (customer.data.l10n_co_edi_fiscal_regimen === "49") ? 2 : 1;

            let success = true;
            let message = '';

            Object.entries(seller).forEach(([keyof, value]) => {
                if (!value) {
                    success = false;
                    message += `El campo ${keyof} del vendedor es obligatorio. `;
                }
            });

            if (success) message = 'Vendedor generado con éxito';
            else message = `Errores encontrados al crear al vendedor: ${message}`;

            return { success: success, message: message, data: seller };
        } catch (error) {
            console.error('Error al generar el vendedor del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera la sección "payment_form" del JSON a partir del account.move:
     * - payment_form_id: 1 contado, 2 crédito (mapeado desde payment term).
     * - payment_method_id: obtenido desde l10n_co_edi_payment_option_id.
     * - duration_measure y payment_due_date desde fechas de factura.
     *
     * @async
     * @param {{ data:Object }} supportDocument - Movimiento (account.move) con sus campos en data.
     * @returns {Promise<{success:boolean, message:string, data:Object}>}
     *  - success true: data con forma de pago.
     *  - success false: mensaje de validación.
     */
    async generate_json_support_document_payment_form(supportDocument) {
        try {
            //En odoo el unico pago a contado es el id 1 el resto son credito(nextpyme 1 contado 2 credito)
            const payment_form = {};
            payment_form.payment_form_id = 2;
            if (supportDocument.data.invoice_payment_term_id[0] == 1) payment_form.payment_form_id = 1;

            const payment_id = supportDocument.data.l10n_co_edi_payment_option_id[0];
            if (!payment_id) return { statusCode: 400, message: "La factura no tiene método de pago" };

            const paymentMethodCode = await paymentMethodService.getPaymentMethodCodeById(payment_id);
            if (paymentMethodCode.statusCode !== 200) return paymentMethodCode;
            payment_form.payment_method_id = paymentMethodCode.data[0].id;


            const invoice_date = new Date(supportDocument.data.invoice_date);
            const invoice_date_due = new Date(supportDocument.data.invoice_date_due);
            const diferenciaMs = invoice_date_due - invoice_date;
            const dias = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));
            payment_form.duration_measure = dias || 0;

            payment_form.payment_due_date = supportDocument.data.invoice_date_due;

            let success = true;
            let message = '';
            console.log("payment_form", payment_form);

            Object.entries(payment_form).forEach(([keyof, value]) => {
                if (!value && value !== 0) {
                    success = false;
                    message += `El campo ${keyof} de la forma de pago es obligatorio. `;
                }
            });

            if (success) message = 'Forma de pago generada con éxito';
            else message = `Errores encontrados al crear la forma de pago: ${message}`;

            return { success: success, message: message, data: payment_form };
        } catch (error) {
            console.error('Error al generar la forma de pago del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera las líneas (invoice_lines) del JSON del documento de soporte.
     * Incluye unidad de medida UBL, descuentos por línea y start_date del servicio.
     *
     * @async
     * @param {{ data:Object }} supportDocument - Movimiento (account.move) base para obtener sus líneas.
     * @returns {Promise<{success:boolean, message:string, data:Array}>}
     *  - success true: data con arreglo de líneas.
     *  - success false: error de validación o datos faltantes.
     */
    async generate_json_support_document_lines(supportDocument) {
        try {
            const lines = await billService.getLinesByBillId(supportDocument.data.id, 'full');

            const invoice_lines = [];

            for (const line of lines.data) {
                let unitMeasureCode = { id: 70 }; // Valor por defecto unidad
                //console.log(line.product_uom_id)
                if (line.product_uom_id) {
                    const unitMeasureCodeResponse = await unitMeasureService.getUnitMeasureCodeById(line.product_uom_id[0]);
                    if (unitMeasureCodeResponse.statusCode !== 200) return unitMeasureCodeResponse;
                    unitMeasureCode = unitMeasureCodeResponse.data[0];
                    //console.log("unitMeasureCode", unitMeasureCodeResponse);
                }

                const invoice_line = {
                    code: line.product_id ? line.product_id[1] : line.account_id[1],
                    notes: line.name || "",
                    description: line.name,
                    price_amount: line.price_unit.toFixed(2),
                    base_quantity: line.quantity || 1,
                    unit_measure_id: unitMeasureCode.id,
                    invoiced_quantity: line.quantity,
                    line_extension_amount: line.price_subtotal,
                    //Estos campos me dijo Esteban que eran fijos
                    free_of_charge_indicator: false,
                    type_item_identification_id: 4,
                    type_generation_transmition_id: 1
                }

                const pricePerUnits = line.quantity * line.price_unit;
                const discount = pricePerUnits - line.price_subtotal;
                if (discount > 0) {
                    const allowance_charges = [{
                        amount: (discount).toFixed(2),
                        base_amount: (pricePerUnits).toFixed(2),
                        charge_indicator: false,
                        allowance_charge_reason: "DESCUENTO PARA LA LINEA"
                    }];
                    invoice_line.allowance_charges = allowance_charges;
                }

                const countDays = util_date.getDiffDates(new Date(supportDocument.data.l10n_co_dian_post_time.split(" ")[0]), new Date(line.deferred_start_date));

                invoice_line.start_date = supportDocument.data.l10n_co_dian_post_time.split(" ")[0];

                if (line.deferred_start_date && (countDays <= 6)) {
                    invoice_line.start_date = line.deferred_start_date;
                }

                invoice_lines.push(invoice_line);
            }


            return { success: true, message: 'Líneas del documento generadas con éxito', data: invoice_lines };
        } catch (error) {
            console.error('Error al generar las líneas del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera cargos/descuentos globales del documento (allowance_charges).
     * Actualmente retorna un descuento global 0.00 como estructura por defecto.
     *
     * @async
     * @param {{ data:Object }} supportDocument - Movimiento (account.move).
     * @returns {Promise<{success:boolean, message:string, data:Array}>}
     */
    async generate_json_support_document_allowance_charges(supportDocument) {
        try {
            const allowance_charges = [{
                amount: "0.00",
                base_amount: supportDocument.data.amount_untaxed.toFixed(2),
                discount_id: 10,
                charge_indicator: false,
                allowance_charge_reason: "DESCUENTO GENERAL"
            }]
            return { success: true, message: 'Cargos y descuentos generados con éxito', data: allowance_charges };
        } catch (error) {
            console.error('Error al generar los cargos y descuentos del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera los totales monetarios legales del documento (legal_monetary_totals).
     *
     * @async
     * @param {{ data:Object }} supportDocument - Movimiento (account.move) con montos calculados.
     * @returns {Promise<{success:boolean, message:string, data:{
     *   payable_amount:string,
     *   tax_exclusive_amount:string,
     *   tax_inclusive_amount:string,
     *   line_extension_amount:string,
     *   charge_total_amount:string,
     *   allowance_total_amount:string
     * }}>}
     */
    async generate_json_support_document_legal_monetary_totals(supportDocument) {
        try {
            const legal_monetary_totals = {
                payable_amount: (supportDocument.data.amount_total).toFixed(2),
                tax_exclusive_amount: "0.00",
                tax_inclusive_amount: (supportDocument.data.amount_total).toFixed(2),
                line_extension_amount: (supportDocument.data.amount_untaxed).toFixed(2),
                charge_total_amount: "0.00",
                allowance_total_amount: "0.00"
            }
            return { success: true, message: 'Montos monetarios legales generados con éxito', data: legal_monetary_totals };
        } catch (error) {
            console.error('Error al generar los totales monetarios legales del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera la referencia de facturación (billing_reference) para notas crédito de soporte.
     *
     * @async
     * @param {{uuid:string, number:string|number, issue_date:string}} data - Datos de la factura original.
     * @returns {Promise<{success:boolean, message:string, data:{uuid:string, number:string|number, issue_date:string}}>}
     */
    async generate_json_support_document_billing_reference(data) {

        try {
            const { uuid, number, issue_date } = data;
            const billing_reference = {
                uuid,
                number,
                issue_date
            };
            return { success: true, message: 'Referencia de facturación generada con éxito', data: billing_reference };
        } catch (error) {
            console.error('Error al generar la referencia de facturación del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Genera los totales de retención (with_holding_tax_total) del documento.
     * Actualmente retorna estructura vacía; pendiente implementar.
     *
     * @async
     * @param {{ data:Object }} supportDocument - Movimiento (account.move).
     * @returns {Promise<{success:boolean, message:string, data:Array}>}
     */
    async generate_json_support_document_with_holding_tax_total(supportDocument) {

        try {
            const taxesCode = await taxService.getTaxCodeById(18);
            console.log("taxesCode", taxesCode);
            if (taxesCode.statusCode !== 200) return taxesCode;
            console.log("taxesCode", taxesCode.data);
/**
            const with_holding_tax_total = {
                tax_id: taxesCode.data.id,
                tax_amount: taxesCode.data.amount,
                percent: taxesCode.data.percent,
                taxable_amount
            }
*/
            return { success: true, message: 'Totales de retención generados con éxito', data: [] };
        } catch (error) {
            console.error('Error al generar los totales de retención del documento de soporte:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Construye el JSON final del documento de soporte para envío a NextPyme/DIAN.
     * - type_document_id: 11 (SD) o 13 (SD Credit Note si reversed_entry_id).
     * - Cuando es nota crédito: mueve invoice_lines a credit_note_lines, agrega billing_reference,
     *   y elimina campos no aplicables.
     *
     * @async
     * @param {number|string} documentId - ID del account.move ya confirmado (state = posted).
     * @returns {Promise<{statusCode:number, message:string, data:Object}>}
     *  - 201: JSON generado.
     *  - 404/400: validaciones fallidas.
     *  - 500: error interno.
     */
    async createSupportDocumentJson(documentId) {

        // Lógica para crear un nuevo documento de soporte en la base de datos
        try {
            console.log(documentId)
            const supportDocument = await this.getSupportDocumentContentById(documentId, [["state", "=", "posted"]]);
            console.log("supportDocument", supportDocument);
            if (supportDocument.statusCode !== 200) return { statusCode: 404, message: 'Documento no encontrado o no está confirmado', data: [] };
            console.log("Creando documento de soporte JSON para ID:", supportDocument.data);
            const customer = await partnerService.getOnePartner(supportDocument.data.partner_id[0]);
            if (customer.statusCode !== 200) return customer;

            //---------------------------------------------- Vendedor --------------------------------------------------//

            const sellerJson = await this.generate_json_support_document_seller(customer);
            if (!sellerJson.success) return { statusCode: 400, message: sellerJson.message, data: [] };
            const seller = sellerJson.data;

            //---------------------------------------------- Forma de pago--------------------------------------------------//
            const paymentFormJson = await this.generate_json_support_document_payment_form(supportDocument);
            if (!paymentFormJson.success) return { statusCode: 400, message: paymentFormJson.message, data: [] };
            const payment_form = paymentFormJson.data;


            //---------------------------------------------- Líneas de la factura ----------------------------------------------//

            const invoiceLinesJson = await this.generate_json_support_document_lines(supportDocument);
            if (!invoiceLinesJson.success) return { statusCode: 400, message: invoiceLinesJson.message, data: [] };
            const invoice_lines = invoiceLinesJson.data;
            //---------------------------------------------- Descuentos Totales de la factura ----------------------------------------------//

            const allowanceChargesJson = await this.generate_json_support_document_allowance_charges(supportDocument);
            if (!allowanceChargesJson.success) return { statusCode: 400, message: allowanceChargesJson.message, data: [] };
            const allowance_charges = allowanceChargesJson.data;

            //---------------------------------------------- Montos legales ----------------------------------------------//

            const legalMonetaryTotalsJson = await this.generate_json_support_document_legal_monetary_totals(supportDocument);
            if (!legalMonetaryTotalsJson.success) return { statusCode: 400, message: legalMonetaryTotalsJson.message, data: [] };
            const legal_monetary_totals = legalMonetaryTotalsJson.data;


            //---------------------------------------------- JSON Final ----------------------------------------------//



            const journalData = await journalService.getOneJournal(supportDocument.data.journal_id[0]);
            if (journalData.statusCode !== 200) return journalData;

            //console.log("journalData", journalData.data);

            const jsonSupportDocument = {
                date: supportDocument.data.l10n_co_dian_post_time.split(" ")[0],
                time: supportDocument.data.l10n_co_dian_post_time.split(" ")[1],
                notes: supportDocument.data.narration,
                number: Number(supportDocument.data.name.split("/")[1]),
                prefix: journalData.data.code,
                seller: seller,
                sendmail: false,
                foot_note: "Nota: Documento generado desde Odoo API",
                payment_form: payment_form,
                sendmailtome: false,
                invoice_lines: invoice_lines,
                type_document_id: 11,
                resolution_number: supportDocument.data.l10n_latam_document_number,
                resolution_number: journalData.data.l10n_co_edi_dian_authorization_number,
                legal_monetary_totals: legal_monetary_totals,
            };

            if (Number(allowance_charges.amount) > 0) {
                jsonSupportDocument.allowance_charges = allowance_charges;
            }

            //-------------------------------------------------BILLING-REFERENCE ----------------------------------------------//
            if (supportDocument.data.reversed_entry_id?.length > 0) {
                const originalBillData = await billService.getOneBill(supportDocument.data.reversed_entry_id[0]);
                if (originalBillData.statusCode !== 200) return originalBillData;

                const billingReferenceJson = await this.generate_json_support_document_billing_reference({
                    uuid: originalBillData.data.x_studio_uuid_dian,
                    number: originalBillData.data.name.split("/")[1],
                    issue_date: originalBillData.data.invoice_date
                });
                delete jsonSupportDocument.invoice_lines;
                delete jsonSupportDocument.resolution_number;
                jsonSupportDocument.billing_reference = billingReferenceJson.data;
                jsonSupportDocument.type_document_id = 13;
                jsonSupportDocument.credit_note_lines = invoice_lines;
                jsonSupportDocument.discrepancyresponsecode = supportDocument.data.l10n_co_edi_description_code_credit;
                jsonSupportDocument.discrepancyresponsedescription = (supportDocument.data.ref.split(', ')[1]);

            }

            await this.generate_json_support_document_with_holding_tax_total(supportDocument)

            return { statusCode: 201, message: 'Documento creado con éxito', data: jsonSupportDocument };
        } catch (error) {
            console.error('Error al crear el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }

    },

    /**
     * Confirma el documento de soporte en Odoo y lo envía a DIAN vía NextPyme.
     * Flujo:
     *  1) Confirmar move (post).
     *  2) Generar JSON (createSupportDocumentJson).
     *  3) Enviar a NextPyme (SD o SD Note).
     *  4) Actualizar CUFE/CUDE y UUID en la factura.
     *  5) Cargar archivos de respuesta al documento.
     *
     * @async
     * @param {number|string} documentId - ID del account.move.
     * @returns {Promise<{statusCode:number, message:string, data:any}>}
     *  - 200: confirmado y enviado con éxito.
     *  - 4xx/5xx: error en confirmación, generación o envío.
     */
    async confirmSupportDocument(documentId) {
        try {
            //Confirmar el documento de soporte
            const confirmDocument = await billService.confirmBill(documentId);
            if (confirmDocument.statusCode !== 200) return confirmDocument;

            const supportDocument = await this.createSupportDocumentJson(documentId);
            if (supportDocument.statusCode !== 201) return supportDocument;

            let cuds, uuid_dian, documentResponse;
            //Enviar el documento a DIAN 

            if (supportDocument.data.prefix === "NDSN") {
                const dianResponse = await nextPymeService.sendSupportDocumentNoteToDian(supportDocument.data);
                if (dianResponse.statusCode !== 200) return dianResponse;
                console.log("dianResponse", dianResponse);
                cuds = dianResponse.data.cuds;
                uuid_dian = dianResponse.data.uuid_dian;
                documentResponse = dianResponse;
            } else {
                const dianDocument = await nextPymeService.sendSupportDocumentToDian(supportDocument.data);
                if (dianDocument.statusCode !== 200) return dianDocument;
                console.log("dianDocument", dianDocument);
                cuds = dianDocument.data.cuds;
                uuid_dian = dianDocument.data.uuid_dian;
                documentResponse = dianDocument;
            }

            const updateBill = await billService.updateBill(documentId, { l10n_co_edi_cufe_cude_ref: cuds || '', x_studio_uuid_dian: uuid_dian || '' }, 'update');

            //Cargar archivos al documento de soporte
            const uploadFiles = await billService.uploadFilesFromDian(documentId, documentResponse.data);
            if (uploadFiles.statusCode !== 200) return uploadFiles;

            return { statusCode: 200, message: 'Documento de soporte confirmado y enviado a DIAN con éxito', data: [] };
        } catch (error) {
            console.error('Error al confirmar el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }

    }

}

module.exports = { supportDocumentService };
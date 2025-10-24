const odooConector = require('../utils/odoo.service');
const billService = require('./bills.service');
const { typeLiabilityService } = require('./liability.service');
const { municipalityService } = require('./municipality.service');
const partnerService = require('./partner.service');
const { paymentMethodService } = require('./paymentMethod.service');


const supportDocumentService = {
    async getSupportDocumentContent(documentId) {
        // Lógica para obtener el contenido del documento de soporte desde la base de datos
        try {
            const document = await billService.getBills([], [["journal_id", "=", 15], ["move_type", "=", "in_invoice"]]);
            if (document.statusCode !== 200) {
                return { statusCode: 404, error: true, message: 'Documento no encontrado', data: [] };
            }

            return { statusCode: 200, error: false, message: 'Documento obtenido con éxito', data: document.data };

        } catch (error) {
            console.error('Error al obtener el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    async getSupportDocumentContentById(documentId, domain = []) {
        // Lógica para obtener el contenido del documento de soporte desde la base de datos
        try {
            const document = await billService.getOneBill(documentId, [["journal_id", "=", 15], ["move_type", "=", "in_invoice"], ...domain]);
            if (document.statusCode !== 200) {
                return { statusCode: 404, error: true, message: 'Documento no encontrado', data: [] };
            }

            return { statusCode: 200, error: false, message: 'Documento obtenido con éxito', data: document.data };

        } catch (error) {
            console.error('Error al obtener el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    async createSupportDocument(documentData) {
        // Lógica para crear un nuevo documento de soporte en la base de datos
        try {

            // Aquí iría la lógica para crear el documento
            const supportDocumentData = documentData
            // Mapea los campos necesarios 
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

    async createSupportDocumentJson(documentId) {

        // Lógica para crear un nuevo documento de soporte en la base de datos
        try {

            const supportDocument = await this.getSupportDocumentContentById(documentId);
            if (supportDocument.statusCode !== 200) return supportDocument;

            console.log('supportDocument.data', supportDocument.data);

            const customer = await partnerService.getOnePartner(supportDocument.data.partner_id[0]);
            if (customer.statusCode !== 200) return customer;

            console.log('customer.data', customer.data);

            //codigo del municipio
            const city = await municipalityService.getMunicipalityCodeById(customer.data.city_id[0]);
            if (city.statusCode !== 200) return city;

            const typeLiability = await typeLiabilityService.getTypeLiabilityCodeById(customer.data.l10n_co_edi_obligation_type_ids[0]);
            if (typeLiability.statusCode !== 200) return typeLiability;
            //---------------------------------------------- Vendedor --------------------------------------------------//
            const seller = {
                identification_number: customer.data.vat.includes('-') ? customer.data.vat.split('-')[0] : customer.data.vat,
                name: customer.data.name,
                phone: customer.data.phone,
                address: customer.data.street,
                email: customer.data.email,
                merchant_registration: customer.data.x_studio_registro_mercantil ? customer.data.x_studio_registro_mercantil : '0000000',
                postal_zone_code: customer.data.postal_zone_code,
                type_document_identification_id: customer.data.type_document_identification_id,
                type_organization_id: customer.data.type_organization_id,
                type_liability_id: typeLiability.data[0].id,
            }

            if (customer.data.vat.includes('-')) seller.dv = customer.data.vat.split('-')[1];
            if (city.data) seller.municipality_id = city.data[0].id;
            if (customer.data.l10n_co_edi_fiscal_regimen) seller.type_regime_id = (customer.data.l10n_co_edi_fiscal_regimen === "49") ? 2 : 1;

            //---------------------------------------------- Forma de pago--------------------------------------------------//
            const payment_form = {};

            //En odoo el unico pago a contado es el id 1 el resto son credito(nextpyme 1 contado 2 credito)
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
            payment_form.duration_measure = dias;

            payment_form.payment_due_date = supportDocument.data.invoice_date_due;
            //---------------------------------------------- Fin Forma de pago----------------------------------------------//


            const notes = supportDocument.data.x_studio_notas || "";


            //---------------------------------------------- Líneas de la factura ----------------------------------------------//
            const lines = await billService.getLinesByBillId(supportDocument.data.id, 'full');

            const invoice_lines = [];

            for (const line of lines.data) {
                //console.log('liness', line);
                const allowance_charges = [{
                    amount: line.deductible_amount.toFixed(2),
                    base_amount: (Number(line.price_subtotal)+Number(line.deductible_amount)).toFixed(2),
                    charge_indicator: false,
                    allowance_charge_reason: "DESCUENTO GENERAL"
                }];

                invoice_lines.push({
                    code: line.product_id ? line.product_id[1] : line.account_id[1],
                    notes: line.quantity,
                    start_date: line.date,
                    description: line.name,
                    price_amount: line.price,
                    base_quantity: line.quantity,
                    unit_measure_id: line.uom_id,
                    allowance_charges: allowance_charges,
                    invoiced_quantity: line.quantity,
                    line_extension_amount: line.price_subtotal,
                    free_of_charge_indicator: false,
                    type_item_identification_id: 4,
                    type_generation_transmition_id: 1
                });
            }

            //---------------------------------------------- Descuentos Totales de la factura ----------------------------------------------//

            const allowance_charges = [{
                amount: "0.00",
                base_amount: supportDocument.data.amount_untaxed.toFixed(2),
                discount_id: 10,
                charge_indicator: false,
                allowance_charge_reason: "DESCUENTO GENERAL"
            }]

            //---------------------------------------------- Montos legales ----------------------------------------------//

            const legal_monetary_totals = {
                payable_amount: (supportDocument.data.amount_total).toFixed(2),
                tax_exclusive_amount: (supportDocument.data.amount_untaxed).toFixed(2),
                tax_inclusive_amount: (supportDocument.data.amount_total).toFixed(2),
                line_extension_amount: (supportDocument.data.amount_untaxed).toFixed(2),
                charge_total_amount: "0.00",
                allowance_total_amount: "0.00"
            }

            //---------------------------------------------- JSON Final ----------------------------------------------//

            const jsonSupportDocument = {
                date: supportDocument.data.date,
                time: supportDocument.data.invoice_datetime,
                notes: supportDocument.data.narration,
                number: supportDocument.data.name,
                prefix: supportDocument.data.l10n_latam_document_number_prefix,
                seller: seller,
                sendmail: false,
                foot_note: "Nota: Documento generado desde Odoo API",
                payment_form: payment_form,
                sendmailtome: false,
                invoice_lines: invoice_lines,
                type_document_id: 11,
                resolution_number: supportDocument.data.l10n_latam_document_number,
                allowance_charges: allowance_charges,
                legal_monetary_totals: legal_monetary_totals,
            };


            return { statusCode: 201, message: 'Documento creado con éxito', data: jsonSupportDocument };
        } catch (error) {
            console.error('Error al crear el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }

    }

}

module.exports = { supportDocumentService };
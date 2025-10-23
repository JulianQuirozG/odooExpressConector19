const odooConector = require('../utils/odoo.service');
const billService = require('./bills.service');
const { municipalityService } = require('./municipality.service');
const partnerService = require('./partner.service');


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

            console.log('Datos para crear el documento de soporte:', supportDocumentData);

            const supportDocument = await billService.createBill(supportDocumentData);

            console.log('Resultado de la creación del documento de soporte:', supportDocument);

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

            if (supportDocument.statusCode !== 200) {
                return { statusCode: 400, error: true, message: 'Error al crear el documento de soporte', data: [] };
            }
            console.log('supportDocument.data', supportDocument.data);

            const customer = await partnerService.getOnePartner(supportDocument.data.partner_id[0]);
            if (customer.statusCode !== 200) {
                return customer;
            }

            console.log('customer.data', customer.data);

            const city = await municipalityService.getMunicipalityCodeById(customer.data.city_id[0]);
            console.log('city as', city.data);

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
                //type_liability_id: 1,
                //type_regime_id: 1
            }

            const payment_form = {
                payment_form_id: 1,
                duration_measure: 1,
                payment_due_date: 1,
                payment_method_id: 1,
            }
            //Si es pago inmediato
            payment_form.payment_form_id = 2;

            //Si no es pago inmediato, es credito
            if (supportDocument.data.invoice_payment_term_id[0] == 1) payment_form.payment_form_id = 1;

            //Metodo de pago id
            const payment_id = supportDocument.data.l10n_co_edi_payment_option_id[0];
            if (!payment_id) return { statusCode: 400, message: "La factura no tiene método de pago" };
            const payment_method = (await odooConector.executeOdooRequest("l10n_co_edi.payment.option", "search_read", { domain: [['id', '=', payment_id]] }));

            payment_form.payment_method_id = payment_method.data[0].l10n_co_edi_code;

            //Notas de la factura
            const notes = supportDocument.data.x_studio_notas || "";
            //fecha de pago
            payment_form.payment_due_date = supportDocument.data.invoice_date_due;

            const lines = await billService.getLinesByBillId(supportDocument.data.id, 'full');

            const invoice_lines = [];

            for (const line of lines.data) {

                const allowance_charges = [{
                    amount: "0.00",
                    base_amount: "0.00",
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
                    free_of_charge_indicator:   false,
                    type_item_identification_id: 4,
                    type_generation_transmition_id: 1
                });
            }

            const allowance_charges =[{
                amount: "0.00",
                base_amount: "0.00",
                discount_id: 10,
                charge_indicator: false,
                allowance_charge_reason: "DESCUENTO GENERAL"
            }]

            const legal_monetary_totals = {
                payable_amount:(supportDocument.data.amount_total).toFixed(2),
                tax_exclusive_amount:(supportDocument.data.amount_untaxed).toFixed(2),
                tax_inclusive_amount:(supportDocument.data.amount_total).toFixed(2),
                line_extension_amount:(supportDocument.data.amount_untaxed).toFixed(2),
                charge_total_amount:"0.00",
                allowance_total_amount:"0.00"
            }

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

            if (customer.data.vat.includes('-')) seller.dv = customer.data.vat.split('-')[1];
            if (city.data) seller.municipality_id = city.data[0].id;





            return { statusCode: 201, error: false, message: 'Documento creado con éxito', data: jsonSupportDocument };
        } catch (error) {
            console.error('Error al crear el documento de soporte:', error);
            return { statusCode: 500, error: true, message: 'Error interno del servidor', data: [] };
        }

    }

}

module.exports = { supportDocumentService };
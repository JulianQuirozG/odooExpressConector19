const { da } = require("zod/locales");
const { BILL_FIELDS, PRODUCT_FIELDS, PRODUCT_FIELDS_BILL } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const productService = require("./products.service");
const partnerService = require("./partner.service");

const billService = {
    async getBills(billFields = ['name', 'amount_total', 'state']) {
        try {
            const response = await odooConector.executeOdooRequest('account.move', 'search_read', {
                fields: billFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener facturas', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener facturas', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de facturas', data: response.data };
        } catch (error) {
            console.log('Error en billService.getBills:', error);
            return { statusCode: 500, message: 'Error al obtener facturas', error: error.message };
        }
    },
    async getOneBill(id) {
        try {
            const response = await odooConector.executeOdooRequest('account.move', 'search_read', {
                domain: [['id', '=', id]],
                fields: [...BILL_FIELDS, 'invoice_line_ids'],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener factura', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener factura', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Factura no encontrada' };
            }
            return { statusCode: 200, message: 'Detalle de la factura', data: response.data[0] };
        } catch (error) {
            console.log('Error en billService.getOneBill:', error);
            return { statusCode: 500, message: 'Error al obtener factura', error: error.message };
        }
    },
    async createBill(dataBill) {
        try {
            //verifico al partner si viene en el body
            if (dataBill.partner_id) {
                const partnerResponse = await partnerService.getOnePartner(dataBill.partner_id);
                if (partnerResponse.statusCode !== 200) {
                    return { statusCode: partnerResponse.statusCode, message: 'No se puede crear la factura porque el partner no existe', error: partnerResponse.message };
                }
            }
            //obtengo los datos de la factura
            const bill = pickFields(dataBill, BILL_FIELDS);
            //si tiene productos los verifico
            if (dataBill.invoice_line_ids && dataBill.invoice_line_ids.length > 0) {
                const productIds = dataBill.invoice_line_ids.map(line => Number(line.product_id));
                //le paso la lista de ids de productos sin repetidos para verificar que existan
                const productsResponse = await productService.validListId([...new Set(productIds)]);

                if (productsResponse.statusCode === 200) {
                    //filtro las lineas de la factura para quedarme solo con las que tienen productos existentes
                    const cosas = dataBill.invoice_line_ids.filter(line => productsResponse.data.foundIds.includes(Number(line.product_id)));
                    bill.invoice_line_ids = cosas.map(line => [0, 0, line]);

                }
            }

            const response = await odooConector.executeOdooRequest('account.move', 'create', {
                vals_list: [bill]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear factura', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear factura', data: response.data };
            }
            return { statusCode: 201, message: 'Factura creada con éxito', data: response.data };
        } catch (error) {
            console.log('Error en billService.createBill:', error);
            return { statusCode: 500, message: 'Error al crear factura', error: error.message };
        }
    },
    async updateBill(id, dataBill) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }
            const bill = pickFields(dataBill, BILL_FIELDS);

            if (dataBill.invoice_line_ids && dataBill.invoice_line_ids.length >= 0) {

                const lineIds = billExists.data.invoice_line_ids;
                if (lineIds && lineIds.length > 0) {
                    const deleted = await odooConector.executeOdooRequest('account.move.line', 'unlink', {
                        ids: lineIds
                    });
                    console.log(deleted);
                }

                const productResponse = await productService.validListId(dataBill.invoice_line_ids.map(line => { return Number(line.product_id) }));
                const productsFound = dataBill.invoice_line_ids.map((line) => { return productResponse.data.foundIds.includes(Number(line.product_id)) ? [0, 0, pickFields(line, PRODUCT_FIELDS_BILL)] : false }).filter(line => line !== false);
                bill.invoice_line_ids = productsFound;
            }

            const response = await odooConector.executeOdooRequest('account.move', 'write', {
                ids: [Number(id)],
                vals: bill
            });

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar factura', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar factura', data: response.data };
            }
            return { statusCode: 201, message: 'Factura actualizada con éxito', data: response.data };
        } catch (error) {
            console.log('Error en billService.updateBill:', error);
            return { statusCode: 500, message: 'Error al actualizar factura', error: error.message };
        }
    },
    async deleteBill(id) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }
            const response = await odooConector.executeOdooRequest('account.move', 'unlink', {
                ids: [Number(id)]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar factura', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar factura', data: response.data };
            }
            return { statusCode: 200, message: 'Factura eliminada con éxito', data: response.data };

        } catch (error) {
            console.log('Error en billService.deleteBill:', error);
            return { statusCode: 500, message: 'Error al eliminar factura', error: error.message };
        }
    },
    async confirmBill(id) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }
            const response = await odooConector.executeOdooRequest('account.move', 'action_post', {
                ids: [Number(id)]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al confirmar factura', error: response.message };
                }
                return { statusCode: 400, message: 'Error al confirmar factura', data: response.data };
            }
            return { statusCode: 200, message: 'Factura confirmada con éxito', data: response.data };
        } catch (error) {
            console.log('Error en billService.confirmBill:', error);
            return { statusCode: 500, message: 'Error al confirmar factura', error: error.message };
        }
    },
    async resetToDraftBill(id) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }
            const response = await odooConector.executeOdooRequest('account.move', 'button_draft', {
                ids: [Number(id)]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al reestablecer factura a borrador', error: response.message };
                }
                return { statusCode: 400, message: 'Error al reestablecer factura a borrador', data: response.data };
            }
            return { statusCode: 200, message: 'Factura reestablecida a borrador con éxito', data: response.data };
        } catch (error) {
            console.log('Error en billService.resetToDraftBill:', error);
            return { statusCode: 500, message: 'Error al reestablecer factura a borrador', error: error.message };
        }
    },
    async createDebitNote(id, dataDebit) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }

            // Crear el wizard de nota de débito
            const wizardData = {
                move_ids: [[6, 0, [Number(id)]]],
                reason: dataDebit.reason || 'Nota de débito',
                date: dataDebit.date || new Date().toISOString().split('T')[0],
                journal_id: dataDebit.journal_id || false
            };

            const wizardResponse = await odooConector.executeOdooRequest('account.debit.note', 'create', {
                vals_list: [wizardData]
            });

            if (!wizardResponse.success) {
                return { statusCode: 500, message: 'Error al crear wizard de nota de débito', error: wizardResponse.message };
            }

            // Ejecutar la creación de la nota de débito
            const debitNoteResponse = await odooConector.executeOdooRequest('account.debit.note', 'create_debit', {
                ids: wizardResponse.data
            });

            if (!debitNoteResponse.success) {
                return { statusCode: 500, message: 'Error al crear nota de débito', error: debitNoteResponse.message };
            }

            return { statusCode: 201, message: 'Nota de débito creada con éxito', data: debitNoteResponse.data };

        } catch (error) {
            console.log('Error en billService.createDebitNote:', error);
            return { statusCode: 500, message: 'Error al crear nota de débito', error: error.message };
        }
    },
    async createCreditNote(id, dataCredit) {
        try {
            const billExists = await this.getOneBill(id);
            if (billExists.statusCode !== 200) {
                return { statusCode: billExists.statusCode, message: billExists.message, data: billExists.data };
            }

            // Crear el wizard de nota de débito
            const wizardData = {
                move_ids: [[6, 0, [Number(id)]]],
                reason: dataCredit.reason || 'Nota de crédito',
                date: dataCredit.date || new Date().toISOString().split('T')[0],
                journal_id: dataCredit.journal_id || false,
                //refund_method: 'refund' // 'refund', 'cancel', 'modify'
            };

            const wizardResponse = await odooConector.executeOdooRequest('account.move.reversal', 'create', {
                vals_list: [wizardData]
            });

            if (!wizardResponse.success) {
                return { statusCode: 500, message: 'Error al crear wizard', error: wizardResponse.message };
            }

            const creditNoteResponse = await odooConector.executeOdooRequest('account.move.reversal', 'reverse_moves', {
                ids: wizardResponse.data
            });

            if (!creditNoteResponse.success) {
                return { statusCode: 500, message: 'Error al crear nota de crédito', error: creditNoteResponse.message };
            }

            return { statusCode: 201, message: 'Nota de crédito creada con éxito', data: creditNoteResponse.data };

        } catch (error) {
            console.log('Error en billService.createCreditNote:', error);
            return { statusCode: 500, message: 'Error al crear nota de crédito', error: error.message };
        }
    }
}

module.exports = billService;
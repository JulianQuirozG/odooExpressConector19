const odooConector = require("../utils/odoo.service");
const billService = require("./bills.service");
const quotationService = require("./quotation.service");
const productService = require("./products.service");
const accountingEntryService = {

    /**
     * Genera y contabiliza el asiento de “ingreso para terceros” a partir de una factura de venta/nota crédito publicada.
     * Flujo:
     * - Valida que la factura exista, sea out_invoice/out_refund y esté en estado posted.
     * - Busca sus órdenes de venta y, por cada una, las órdenes de compra asociadas.
     * - Por cada OC con factura de proveedor publicada, obtiene el producto (1ª línea) y sus cuentas contables.
     * - Construye 2 líneas contables (utilidad/costo y tercero) y crea el asiento usando createAccountingEntry.
     * - En notas crédito invierte los débitos/créditos.
     *
     * @async
     * @param {number} billId ID de la factura/nota en Odoo (account.move).
     * @returns {Promise<{statusCode:number, message:string, data?:any, error?:string}>}
     *          200: asiento creado (data incluye respuesta de Odoo);
     *          400: validación fallida o sin líneas;
     *          500: error inesperado.
     *
     * @example
     * const res = await accountingEntryService.createExternalAccountingEntry(123);
     * if (res.statusCode === 200) console.log('Asiento creado:', res.data);
     */
    async createExternalAccountingEntry(billId) {
        try {
            //verificamos que la factura exista
            const bill = await billService.getOneBill(billId);
            if (bill.statusCode !== 200) return bill;

            //Verificamos que la factura sea de venta y este confirmada
            if (bill.data.move_type !== 'out_invoice' && bill.data.move_type !== 'out_refund') return { statusCode: 400, message: 'La factura no es de venta o nota credito, no se le puede hacer ingreso de terceros', data: [] };
            if (bill.data.state !== 'posted') return { statusCode: 400, message: 'La factura no está confirmada', data: [] };

            //Obtenemos sus ordenes de venta
            const salesOrders = await billService.getSaleOrdersByBillId(billId);
            if (salesOrders.statusCode !== 200) return salesOrders;
            const lines = []
            //Nos recorremos cada orden de venta
            for (const order of salesOrders.data) {

                //Obtenemos las ordenes de compra relacionadas a cada orden de venta
                const purchaseOrders = await quotationService.getPurchaseOrdersBySaleOrderId(order.id);
                if (purchaseOrders.statusCode !== 200) return purchaseOrders;

                //Por cada orden de compra generamos el ingreso para tercero
                for (const purchaseOrder of purchaseOrders.data) {

                    //Obtener la factura de orden de compra
                    const purchaseOrderInvoice = await billService.getOneBill(purchaseOrder.invoice_ids[0]);
                    if (purchaseOrderInvoice.statusCode !== 200) return purchaseOrderInvoice;

                    //Solo facturas que esten validadas
                    if (purchaseOrderInvoice.data.state !== 'posted') continue;
                    const partnerId = purchaseOrder.partner_id[0]; // id del tercero
                    const amount = purchaseOrder.amount_total; // monto total de la orden de compra

                    //Obtengo las lineas de la factura de compra
                    const purchaseOrderLines = await odooConector.executeOdooRequest('account.move.line', 'search_read', {
                        domain: [['move_id', '=', purchaseOrderInvoice.data.id]],
                        fields: ['product_id']
                    });

                    //Obtengo el producto de la primera linea
                    const productId = purchaseOrderLines.data.length > 0 ? purchaseOrderLines.data[0].product_id[0] : null;
                    if (!productId) continue;

                    const product = await productService.getOneProduct(productId);
                    if (product.statusCode !== 200) return product;

                    //Obtenemos la cuenta de ingresos para terceros segun el producto suministrado
                    const utilityAccountId = product.data.property_account_income_id[0];

                    //Obtenemos la cuenta de utilidades
                    const externalEntryAccountId = product.data.property_account_expense_id[0];

                    //Si es nota credito hacemos ingreso de terceros, si es nota credito hacemos la operacion inversa
                    let utilityAccountDebit = amount, utilityAccountCredit = 0.0, externalEntryAccountDebit = 0.0, externalEntryAccountCredit = amount;
                    let utilityAccountName = "Descontamos el costo generado automáticamente";
                    let externalEntryAccountName = "Ingreso para terceros generados automáticamente";

                    if (bill.data.move_type === 'out_refund') {
                        utilityAccountDebit = 0.0;
                        utilityAccountCredit = amount;
                        externalEntryAccountDebit = amount;
                        externalEntryAccountCredit = 0.0;
                        utilityAccountName = "Revertimos el costo generado automáticamente";
                        externalEntryAccountName = "Revertimos el ingreso para terceros generado automáticamente";
                    }

                    lines.push([0, 0, { name: utilityAccountName, debit: utilityAccountDebit, credit: utilityAccountCredit, "partner_id": bill.data.partner_id[0], account_id: utilityAccountId }])
                    lines.push([0, 0, { name: externalEntryAccountName, debit: externalEntryAccountDebit, credit: externalEntryAccountCredit, "partner_id": partnerId, account_id: externalEntryAccountId }])
                }
            }

            //Asignamos la referencia del asiento contable segun si es factura o nota credito
            let accountingEntryref = `Utilidad generada automáticamente para ${bill.data.name}`;
            if (bill.data.move_type === 'out_refund') accountingEntryref = `Reversión de utilidad generada automáticamente para ${bill.data.name}`;
            
            //Creamos el asiento contable
            const accountingEntry = await this.createAccountingEntry(lines, accountingEntryref, bill.data.invoice_date, 12);
            if (accountingEntry.statusCode !== 200) return accountingEntry;

            return { statusCode: 200, message: 'Ingreso para terceros generados exitosamente', data: accountingEntry.data };
        } catch (error) {
            console.log('Error en journalService.getJournals:', error);
            return { statusCode: 500, message: 'Error creando el ingreso p', error: error.message };
        }
    },

    /**
     * Crea un asiento contable (account.move) en Odoo con las líneas indicadas.
     *
     * @async
     * @param {Array<[0,0, {name:string, debit:number, credit:number, partner_id:number, account_id:number}]>} lines
     *        Comandos one2many para line_ids (formato [0,0,vals] por cada línea).
     * @param {string} [Ref='Nuevo asiento contable'] Referencia del asiento (campo ref).
     * @param {string|Date} [date=Date.now()] Fecha del asiento (YYYY-MM-DD o Date).
     * @param {number} [journal=12] ID del diario (account.journal) donde se creará el asiento.
     * @returns {Promise<{statusCode:number, message:string, data?:any, error?:string}>}
     *          200: asiento creado; 400: solicitud inválida; 500: error al crear.
     *
     * @example
     * const lines = [
     *   [0, 0, { name: 'Ingreso tercero', debit: 0, credit: 1000, partner_id: 45, account_id: 410505 }],
     *   [0, 0, { name: 'Contrapartida', debit: 1000, credit: 0, partner_id: 78, account_id: 613595 }],
     * ];
     * const res = await accountingEntryService.createAccountingEntry(lines, 'Ref auto', '2025-10-20', 12);
     */
    async createAccountingEntry(lines, Ref = 'Nuevo asiento contable', date = Date.now(), journal = 12) {
        try {
            //Si no tiene lineas
            if (lines.length === 0)
                return { statusCode: 400, message: 'No se proporcionaron líneas para el asiento contable', data: [] };

            //Preparamos el asiento contable
            const accountEntryData = {
                ref: Ref,
                date: date,
                journal_id: journal,
                line_ids: lines
            }

            //Creamos el asiento contable
            const accountingEntry = await odooConector.executeOdooRequest('account.move', 'create', {
                vals_list: [accountEntryData]
            });
            if (accountingEntry.error) return { statusCode: 500, message: 'Error al crear el asiento contable', error: accountingEntry.error.message };
            if (!accountingEntry.success) return { statusCode: 400, message: 'Error al crear el asiento contable', data: accountingEntry.data };

            //Regresamos la información del asiento contable creado
            return { statusCode: 200, message: 'Asiento contable creado exitosamente', data: accountingEntry.data };
        } catch (error) {
            console.log('Error en journalService.getJournals:', error);
            return { statusCode: 500, message: 'Error al obtener diarios', error: error.message };
        }
    }
}

module.exports = { accountingEntryService };

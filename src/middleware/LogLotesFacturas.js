const { getIdsBill, claimBillRecord, createBillRecord, CompleteBillRecord, ErrorBillRecord } = require("../Repository/lotesprocesarfactura/lotesprocesarfactura.repository");
const billService = require('../services/bills.service');
const { lotesService } = require("../services/BillLotesDb.service");

const controlCron = async (req, res, next) => {
    try {
        const invoiceId =
            req.params?.id ?? req.body?.id ?? req.body?.invoice_id ?? req.query?.id;

        // Guarda contexto para usarlo al finalizar
        res.locals._lot = { invoiceId, claimedOrCreated: false, typebill: null };

        // 1) Registrar al entrar
        (async () => {
            try {
                if (!invoiceId) return { statusCode: 400, message: 'No se envió el ID de la factura' };

                const bill = await billService.getOneBill(invoiceId);
                if (bill.statusCode !== 200) {
                    console.error('No se encontró la factura en Odoo para el ID:', invoiceId);
                    return { statusCode: 404, message: 'No se encontró la factura en Odoo' };
                }
                let exists = {};

                // Según el tipo de factura, usar la tabla correspondiente
                // 01: Factura de venta
                // 91: Nota de crédito de venta
                // 92: Nota de débito de venta
                res.locals._lot.typebill = bill.data.l10n_co_edi_type;

                const response = await lotesService.registerinvoiceLoteByType(bill.data.id, bill.data.l10n_co_edi_type);

                //console.log('Respuesta al registrar la factura en el lote:', response);

            } catch (e) {
                console.error('[controlCron] error on enter:', e.message || e);
            }
        })();

        // 2) Registrar al salir (cuando la respuesta ya terminó)
        res.on('finish', async () => {
            try {
                const { invoiceId: id, typebill } = res.locals._lot || {};
                if (!id) return;

                //console.log('finalizing lot for invoiceId', id, 'with status', res.statusCode);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    await lotesService.FinishInvoiceLoteByType(id, typebill); // éxito: done y limpia lease
                } else {
                    await lotesService.FinishInvoiceLoteByType(id, typebill, false); // deja listo para reintento (pending/error)
                }
            } catch (e) {
                console.error('[controlCron] error on finish:', e.message || e);
            }
        });

        next();

    } catch (error) {
        console.error("Error en el control del cron:", error);
        return res.status(500).json({
            statusCode: 500,
            message: "Error en el control del cron",
            error: error.message,
        });
    }

}

module.exports = { controlCron };
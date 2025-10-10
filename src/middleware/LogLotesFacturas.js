const productService = require('../services/products.service');
//const {cron} = require('../job/corn');
const { getIdsBill, claimBillRecord, createBillRecord, CompleteBillRecord, ErrorBillRecord } = require("../Repository/lotesprocesarfactura/lotesprocesarfactura.repository");

const controlCron = async (req, res, next) => {
    try {
        const invoiceId =
            req.params?.id ?? req.body?.id ?? req.body?.invoice_id ?? req.query?.id;

        // Guarda contexto para usarlo al finalizar
        res.locals._lot = { invoiceId, claimedOrCreated: false };

        // 1) Registrar al entrar
        (async () => {
            try {
                if (!invoiceId) return { statusCode: 400, message: 'No se envió el ID de la factura' };
                const exists = await getIdsBill(invoiceId);
                console.log('exists', exists);
                if (exists.data?.length > 0) {
                    // Intenta tomar el lock/lease (solo si está pending/error o lease expirado)
                    const claimed = await claimBillRecord(invoiceId);
                    res.locals._lot.claimedOrCreated = claimed;
                } else {
                    // Crea el registro en processing con TTL (lease)
                    const created = await createBillRecord(invoiceId);
                    res.locals._lot.claimedOrCreated = !!created;
                }
            } catch (e) {
                console.error('[controlCron] error on enter:', e.message || e);
            }
        })();

        // 2) Registrar al salir (cuando la respuesta ya terminó)
        res.on('finish', async () => {
            try {
                const { invoiceId: id } = res.locals._lot || {};
                if (!id) return;
                //console.log('finalizing lot for invoiceId', id, 'with status', res.statusCode);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    await CompleteBillRecord(id); // éxito: done y limpia lease
                } else {
                    await ErrorBillRecord(id); // deja listo para reintento (pending/error)
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
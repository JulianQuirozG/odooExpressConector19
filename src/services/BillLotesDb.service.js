const { CompleteBillRecord, ErrorBillRecord } = require("../Repository/lotesprocesarfactura/lotesprocesarfactura.repository");
const billService = require("./bills.service");

const lotesService = {
    async processJob(bills) {
        try {
            const corrects = [], errors = [];
            //itero las facturas a confirmar
            for (const bill of bills) {
                const dianBill = await billService.SyncAndUpdateBillsDian(bill);

                //si hay error lo guardo en un array de errores, si es correcto lo guardo en un array de correctos
                if (dianBill.statusCode !== 200) {
                    errors.push({ billId: bill, message: dianBill.message, error: dianBill.error || dianBill.data });
                }
                else {
                    corrects.push({ billId: bill, data: dianBill.data });
                }

            }
            //retorno el resultado de la confirmacion
            return { statusCode: 200, message: 'Proceso de confirmación de facturas DIAN finalizado', data: { corrects, errors } };

        } catch (error) {
            console.error('Error al confirmar las facturas', error);
            return {
                statusCode: 500,
                message: 'Error al confirmar las facturas',
                error: error.message
            };
        }
    },
    async processJobFacturas(ids, type) {
        try {
            // Lógica para procesar los lotes
            console.log(`Procesando lote de ${type} con IDs: ${JSON.stringify(ids)}`);
            const response = await this.processJob(ids);

            if (response.statusCode !== 200) {
                console.error(`Error al procesar lote de ${type}:`, response.message);
                return;
            }
            const { corrects, errors } = response.data || { corrects: [], errors: [] };
            corrects.forEach(async item => {
                console.log(`Factura ${item.billId} procesada correctamente.`);
                await CompleteBillRecord(item.billId);
            });

            errors.forEach(async item => {
                console.error(`Error al procesar factura ${item.billId}:`, item.message, item.error);
                await ErrorBillRecord(item.billId);
            });

            return { statusCode: 200, message: 'Proceso de confirmación de facturas DIAN finalizado', data: { corrects, errors } };

            // Aquí iría la lógica específica para cada tipo de lote
        } catch (error) {
            console.error(`Error al procesar lote de ${type}:`, error);
        }
    }
}

module.exports = { lotesService };

// Ejemplo de uso:
// lotesService.processJobFacturas([1, 2, 3], 'facturas');
// lotesService.processJobFacturas([4, 5, 6], 'notas de crédito');
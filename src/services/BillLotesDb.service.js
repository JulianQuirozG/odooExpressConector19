const { CompleteBillRecord, ErrorBillRecord, getIdsBill, claimBillRecord, createBillRecord } = require("../Repository/lotesprocesarfactura/lotesprocesarfactura.repository");
const { getIdsCreditNote, claimCreditNoteRecord, createCreditNoteRecord, ErrorCreditNoteRecord, CompleteCreditNoteRecord } = require("../Repository/lotesprocesarnotacredito/lotesprocesarnotacredito.repository");
const { getIdsDebitNote, claimDebitNoteRecord, createDebitNoteRecord, ErrorDebitNoteRecord, CompleteDebitNoteRecord } = require("../Repository/lotesprocesarnotadebito/lotesprocesarnotadebito.repository");
const billService = require("./bills.service");

const TYPE_STRATEGIES = {
    '01': {
        label: 'Factura de venta',
        exists: getIdsBill,
        claim: claimBillRecord,
        create: createBillRecord,
        error: ErrorBillRecord,
        complete: CompleteBillRecord,
    },
    '91': {
        label: 'Nota de crédito',
        exists: getIdsCreditNote,
        claim: claimCreditNoteRecord,
        create: createCreditNoteRecord,
        error: ErrorCreditNoteRecord,
        complete: CompleteCreditNoteRecord,
    },
    '92': {
        label: 'Nota de débito',
        exists: getIdsDebitNote,
        claim: claimDebitNoteRecord,
        create: createDebitNoteRecord,
        error: ErrorDebitNoteRecord,
        complete: CompleteDebitNoteRecord,
    },
};


const lotesService = {
    /**
     * Procesa un lote de facturas/notas contra DIAN ejecutando SyncAndUpdateBillsDian por cada ID.
     * - Acumula resultados en corrects (éxitos) y errors (fallas con mensaje y detalle).
     *
     * @async
     * @param {number[]} bills Arreglo de IDs de facturas/notas a procesar.
     * @returns {Promise<{statusCode:number, message:string, data?:{corrects:Array<{billId:number, data:any}>, errors:Array<{billId:number, message:string, error?:any}>}, error?:string}>}
     *          200 con resumen de correctos/errores; 500 si ocurre una excepción controlada.
     *
     * @example
     * const res = await lotesService.processJob([101, 102, 103]);
     * if (res.statusCode === 200) {
     *   console.log(res.data.corrects.length, res.data.errors.length);
     * }
     */
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

    /**
     * Orquesta el procesamiento de un lote por tipo (01 factura, 91 NC, 92 ND):
     * - Llama a processJob(ids) para sincronizar con DIAN.
     * - Marca cada ID como completo o error en su tabla de lotes correspondiente.
     *
     * @async
     * @param {number[]} ids Arreglo de IDs a procesar.
     * @param {'01'|'91'|'92'} type Tipo de documento: '01' factura, '91' nota crédito, '92' nota débito.
     * @returns {Promise<{statusCode:number, message:string, data?:{corrects:Array<{billId:number, data:any}>, errors:Array<{billId:number, message:string, error?:any}>}}|void>}
     *          200 con resumen cuando finaliza; puede no retornar valor si processJob falla y se registra el error por consola.
     *
     * @example
     * await lotesService.processJobFacturas([201, 202], '01'); // procesa facturas de venta
     */
    async processJobFacturas(ids, type) {
        try {
            // Lógica para procesar los lotes
            //console.log(`Procesando lote de ${type} con IDs: ${JSON.stringify(ids)}`);
            if (!ids || ids.length === 0) {
                //console.log(`No hay IDs para procesar en el lote de ${type}`);
                return { statusCode: 200, message: `No hay IDs para procesar en el lote de ${type}`, data: { corrects: [], errors: [] } };
            }
            const response = await this.processJob(ids);

            if (response.statusCode !== 200) {
                console.error(`Error al procesar lote de ${type}:`, response.message);
                return;
            }
            const strategy = TYPE_STRATEGIES[type];
            const { corrects, errors } = response.data || { corrects: [], errors: [] };
            corrects.forEach(async item => {
                console.log(`Factura ${item.billId} procesada correctamente.`);
                await strategy.complete(item.billId);
            });

            errors.forEach(async item => {
                console.error(`Error al procesar factura ${item.billId}:`, item.message, item.error);
                await strategy.error(item.billId);
            });

            return { statusCode: 200, message: 'Proceso de confirmación de facturas DIAN finalizado', data: { corrects, errors } };

            // Aquí iría la lógica específica para cada tipo de lote
        } catch (error) {
            console.error(`Error al procesar lote de ${type}:`, error);
        }
    },

    /**
     * Registra una factura/nota en la tabla de lotes según el tipo.
     * - Si ya existe el registro, intenta tomar el lease (claim).
     * - Si no existe, crea el registro.
     *
     * Tipos soportados:
     *  - '01': Factura de venta
     *  - '91': Nota de crédito
     *  - '92': Nota de débito
     *
     * @async
     * @param {number|string} id - ID del documento (account.move) a registrar.
     * @param {'01'|'91'|'92'} type - Tipo de documento del lote.
     * @returns {Promise<{
     *   statusCode: number,
     *   message: string,
     *   data?: { id: number|string, type: '01'|'91'|'92' },
     *   error?: string
     * }>}
     *  - 200: Registro tomado o creado para procesamiento.
     *  - 400: Parámetros inválidos o tipo no soportado.
     *  - 409: No se pudo tomar el lease (otro proceso lo tiene).
     *  - 500: Error al interactuar con el repositorio.
     *
     * @example
     * await lotesService.registerinvoiceLoteByType(123, '01');
     */
    async registerinvoiceLoteByType(id, type) {
        try {
            if (!id || !type) {
                return { statusCode: 400, message: 'id y type son requeridos', data: [] };
            }

            const strategy = TYPE_STRATEGIES[type];
            if (!strategy) {
                return { statusCode: 400, message: `Tipo no soportado: ${type}`, data: [] };
            }

            const existsRes = await strategy.exists(id);
            const exists = existsRes?.statusCode === 200 && existsRes.data?.length > 0;

            if (exists) {
                const claimedRes = await strategy.claim(id);
                if (claimedRes.statusCode !== 200) {
                    return {
                        statusCode: 409,
                        message: 'No se pudo tomar el lease (otro proceso lo tiene o ya está vigente)',
                        data: { id, type },
                    };
                }
            } else {
                const createdRes = await strategy.create(id);
                if (createdRes.statusCode !== 201) {
                    return { statusCode: 500, message: 'No se pudo crear el registro del lote', data: { id, type } };
                }
            }

            return {
                statusCode: 200,
                message: `${strategy.label} registrada para procesamiento`,
                data: { id, type },
            };

        } catch (error) {
            console.error(`registerinvoiceLoteByType error:`, error);
            return { statusCode: 500, message: 'Error al registrar lote de facturas', error: error.message };
        }
    },
    
    /**
     * Finaliza el registro de un documento en la tabla de lotes según resultado.
     * - success = true: marca como completo.
     * - success = false: marca como error.
     *
     * Tipos soportados:
     *  - '01': Factura de venta
     *  - '91': Nota de crédito
     *  - '92': Nota de débito
     *
     * @async
     * @param {number|string} id - ID del documento (account.move) a finalizar.
     * @param {'01'|'91'|'92'} type - Tipo de documento del lote.
     * @param {boolean} [success=true] - Resultado del procesamiento.
     * @returns {Promise<{
     *   statusCode: number,
     *   message: string,
     *   data?: { id: number|string, type: '01'|'91'|'92', success: boolean },
     *   error?: string
     * }>}
     *  - 200: Estado actualizado correctamente.
     *  - 400: Parámetros inválidos o tipo no soportado.
     *  - 404: Registro de lote no encontrado.
     *  - 409: No se pudo actualizar a completo/error (estado inconsistente).
     *  - 500: Error al actualizar el registro.
     *
     * @example
     * await lotesService.FinishInvoiceLoteByType(123, '91', true);
     */
    async FinishInvoiceLoteByType(id, type, success = true) {
        try {
            if (!id || !type) {
                return { statusCode: 400, message: 'id y type son requeridos', data: [] };
            }

            const strategy = TYPE_STRATEGIES[type];
            if (!strategy) {
                return { statusCode: 400, message: `Tipo no soportado: ${type}`, data: [] };
            }

            const existsRes = await strategy.exists(id);
            const exists = existsRes?.statusCode === 200 && existsRes.data?.length > 0;

            if (exists && success) {
                const claimedRes = await strategy.complete(id);
                if (claimedRes.statusCode !== 201) {
                    return {
                        statusCode: 409,
                        message: 'No se pudo tomar actualizar a completo el registro (verifique el estado)',
                        data: { id, type },
                    };
                }
            } else if (exists && !success) {
                const createdRes = await strategy.error(id);
                if (createdRes.statusCode !== 201) {
                    return { statusCode: 500, message: 'No se pudo tomar actualizar a error el registro (verifique el estado)', data: { id, type } };
                }
            } else {
                return { statusCode: 404, message: 'No se encontró el registro del lote', data: { id, type } };
            }

            return {
                statusCode: 200,
                message: `${strategy.label} registrada para procesamiento`,
                data: { id, type, success },
            };

        } catch (error) {
            console.error(`registerinvoiceLoteByType error:`, error);
            return { statusCode: 500, message: 'Error al registrar lote de facturas', error: error.message };
        }
    },
}

module.exports = { lotesService };

// Ejemplo de uso:
// lotesService.processJobFacturas([1, 2, 3], 'facturas');
// lotesService.processJobFacturas([4, 5, 6], 'notas de crédito');
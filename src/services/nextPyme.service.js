const { response } = require("express");
const config = require("../config/config");
const nextPymeConnection = require("../utils/nextPyme.service");
require('dotenv').config();

/**
 * Servicio que encapsula llamadas a la API de NextPyme/DIAN.
 * Usa `utils/nextPyme.service` para realizar las peticiones HTTP.
 */
const nextPymeService = {
    /**
     * Enviar factura a DIAN a través de NextPyme.
     *
     * @async
     * @param {Object} invoiceData - Payload UBL/DIAN a enviar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async sendInvoiceToDian(invoiceData) {
        try {
            const response = await nextPymeConnection.nextPymeRequest('invoice-transport', 'post', invoiceData);
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al enviar la factura a DIAN', error: response.message };
                }
                return { statusCode: 400, message: 'Error al enviar la factura a DIAN', data: response.data };
            }
            return { statusCode: 200, message: 'Factura enviada a DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.sendInvoiceToDian:', error);
            return { statusCode: 500, message: 'Error al enviar la factura a DIAN', error: error.message };
        }
    },

    /**
     * Enviar nota de crédito a DIAN a través de NextPyme.
     *
     * @async
     * @param {Object} creditNoteData - Payload de la nota de crédito.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async sendCreditNoteToDian(creditNoteData) {
        try {
            const response = await nextPymeConnection.nextPymeRequest('credit-note', 'post', creditNoteData);
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al enviar la nota de crédito a DIAN', error: response.message };
                }
                return { statusCode: 400, message: 'Error al enviar la nota de crédito a DIAN', data: response.data };
            }
            return { statusCode: 200, message: 'Nota de crédito enviada a DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.sendCreditNoteToDian:', error);
            return { statusCode: 500, message: 'Error al enviar la nota de crédito a DIAN', error: error.message };
        }
    },

    /**
     * Enviar nota de débito a DIAN a través de NextPyme.
     *
     * @async
     * @param {Object} debitNoteData - Payload de la nota de débito.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async sendDebitNoteToDian(debitNoteData) {
        try {
            const response = await nextPymeConnection.nextPymeRequest('debit-note', 'post', debitNoteData);
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al enviar la nota débito a DIAN', error: response.message };
                }
                return { statusCode: 400, message: 'Error al enviar la nota débito a DIAN', data: response.data };
            }
            return { statusCode: 200, message: 'Nota débito enviada a DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.sendDebitNoteToDian:', error);
            return { statusCode: 500, message: 'Error al enviar la nota débito a DIAN', error: error.message };
        }
    },

    /**
     * Obtener el PDF (base64) de una factura desde NextPyme/DIAN.
     *
     * @async
     * @param {string} invoicePdfId - Identificador de descarga (por ejemplo, la ruta o nombre del recurso en NextPyme).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (base64) o error.
     */
    async getPdfInvoiceFromDian(invoicePdfId) {
        try {
            const response = await nextPymeConnection.nextPymeRequest(`download/${process.env.NIT_EMPRESA}/${invoicePdfId}/BASE64`, 'get');
            if (!response.success) return { statusCode: 400, message: 'Error al obtener el PDF de la factura desde DIAN', data: response.data };
            return { statusCode: 200, message: 'PDF de la factura obtenido desde DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.getPdfInvoiceFromDian:', error);
            return { statusCode: 500, message: 'Error al obtener el PDF de la factura desde DIAN', error: error.message };
        }
    },
    /**
     * Obtener el XML (base64) de una factura desde NextPyme/DIAN.
     *
     * @async
     * @param {string} invoiceXmlId - Identificador de descarga del XML.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (base64) o error.
     */
    async getXmlInvoiceFromDian(invoiceXmlId) {
        try {
            const response = await nextPymeConnection.nextPymeRequest(`download/${process.env.NIT_EMPRESA}/${invoiceXmlId}/BASE64`, 'get');
            if (!response.success) return { statusCode: 400, message: 'Error al obtener el XML de la factura desde DIAN', data: response.data };
            return { statusCode: 200, message: 'XML de la factura obtenido desde DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.getXmlInvoiceFromDian:', error);
            return { statusCode: 500, message: 'Error al obtener el XML de la factura desde DIAN', error: error.message };
        }
    },

    /**
     * Obtener el ZIP asociado a una factura (contenido en base64) desde NextPyme/DIAN.
     *
     * @async
     * @param {string} invoiceZipId - Identificador del ZIP (normalmente parte del nombre de recurso).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (base64) o error.
     */
    async getXmlZipFromDian(invoiceZipId) {
        try {
            const response = await nextPymeConnection.nextPymeRequest(`download/${process.env.NIT_EMPRESA}/ZipAttachm-${invoiceZipId}/BASE64`, 'get');
            if (!response.success) return { statusCode: 400, message: 'Error al obtener el ZIP de la factura desde DIAN', data: response.data };
            return { statusCode: 200, message: 'ZIP de la factura obtenido desde DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.getXmlZipFromDian:', error);
            return { statusCode: 500, message: 'Error al obtener el ZIP de la factura desde DIAN', error: error.message };
        }
    },
    /**
     * Descargar un archivo genérico desde NextPyme/DIAN usando el nombre/route proporcionado.
     *
     * @async
     * @param {string} name - Nombre o ruta del archivo a descargar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (buffer/base64) o error.
     */
    async getFileFromDian(name) {
        try {
            const response = await nextPymeConnection.nextPymeRequest(`download/${config.nextPyme.nit}/${name}`, 'get');
            console.log('Respuesta de nextPyme al obtener archivo de DIAN:', response);
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener el archivo de DIAN', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener el archivo de DIAN', data: response.data };
            }

            return { statusCode: 200, message: 'Archivo obtenido de DIAN', data: response.data };

        } catch (error) {
            console.log('Error en nextPymeService.getFileFromDian:', error);
            return { statusCode: 500, message: 'Error al obtener el archivo de DIAN', error: error.message };
        }
    },

    /**
     * Envía eventos RADIAN a DIAN vía NextPyme.
     * Selecciona automáticamente el endpoint:
     *  - 'send-event-data' si incluye document_reference.cufe,
     *  - 'send-event' en caso contrario.
     *
     * @async
     * @param {Object} radianData - Payload del evento RADIAN (aceptado por NextPyme).
     * @param {Object} [radianData.document_reference] - Referencia del documento.
     * @param {string} [radianData.document_reference.cufe] - CUFE para 'send-event-data'.
     * @returns {Promise<{statusCode:number, message:string, data?:any, error?:any}>}
     *  - 200: Datos enviados correctamente.
     *  - 400: Error en la respuesta de NextPyme.
     *  - 500: Error de conexión/servidor.
     * @example
     * const res = await nextPymeService.sendRadianData({ event_code: '030', document_reference: { cufe: '...' } });
     * if (res.statusCode === 200) console.log('OK');
     */
    async sendRadianData(radianData) {
        try {
            const direction = radianData.document_reference?.cufe ? 'send-event-data' : 'send-event';

            const response = await nextPymeConnection.nextPymeRequest(direction, 'post', radianData);

            if (response.error) return { statusCode: 500, message: 'Error al enviar los datos a Radian', error: response.data };
            if (!response.success) return { statusCode: 400, message: 'Error al enviar los datos a Radian', data: response.data };

            return { statusCode: 200, message: 'Datos enviados a Radian', data: response.data };

        } catch (error) {
            console.log('Error en nextPymeService.sendRadianData:', error);
            return { statusCode: 500, message: 'Error al enviar los datos a Radian', error: error.message };
        }
    },

    /**
     * Envía una o varias nóminas a DIAN vía NextPyme.
     * Valida cada payload, acumula respuestas y errores individuales.
     *
     * @async
     * @param {Array<Object>} payrolls - Lista de JSON de nómina listos para NextPyme.
     * @returns {Promise<{statusCode:number, message:string, data:any[], errors?:any[], error?:any}>}
     *  - 200: data con aceptaciones, errors con rechazos/observaciones.
     *  - 400: No se proporcionaron nóminas o error de validación de NextPyme.
     *  - 500: Falla de conexión/servidor.
     * @example
     * const res = await nextPymeService.sendPayrolltoDian([payrollJson1, payrollJson2]);
     * console.log(res.statusCode, res.data, res.errors);
     */
    async sendPayrolltoDian(payrolls = []) {
        try {
            // Validar que se proporcionen nóminas
            if (!payrolls || payrolls.length == 0) return { statusCode: 400, message: `No se proporcionaron nóminas para enviar a DIAN`, data: [] };

            //Envio nomina por nomina a nextpyme
            const data = [];
            const errors = [];
            for (const payroll of payrolls) {

                //Verifico que los datos de nomina no contengan errores
                if (payroll.error) {
                    errors.push({
                        message: `Error en la nómina ${payroll.error}`,
                        data: []
                    });
                    continue;
                }

                //Envio la nomina a nextpyme
                const response = await nextPymeConnection.nextPymeRequest("payroll", "post", payroll);
                if (response.error) return { statusCode: 500, message: `Error al enviar la nómina de empleado ${payroll.worker.first_name} a DIAN`, error: response.message };
                if (!response.success) { return { statusCode: 400, message: `Error al enviar la nómina de empleado ${payroll.worker.first_name} a DIAN`, data: response.data }; }
                if (response.data.errors) {
                    errors.push({
                        message: `Error al enviar nómina de empleado ${payroll.worker.first_name} : ${response.message}`,
                        data: [errors]
                    });
                }

                //Si nextpyme regresa exito, verifico la respuesta de DIAN
                if (response.data.success) {
                    const result = response.data.ResponseDian.Envelope.Body.SendNominaSyncResponse.SendNominaSyncResult;
                    const valid = result.IsValid == 'true';
                    
                    //Si no es valida, guardo el error
                    if (!valid) {
                        errors.push({
                            message: `Nómina de empleado ${payroll.worker.first_name} rechazada por DIAN: ${result.StatusDescription}`,
                            error: [result.ErrorMessage]
                        });
                    } else {
                        data.push({
                            message: `Nómina de empleado ${payroll.worker.first_name} aceptada por DIAN.`,
                            data: [result]
                        });
                    }
                }
            }
            return { statusCode: 200, message: 'Nóminas procesadas para envío a DIAN', data: data, errors: errors }

        } catch (error) {
            console.error('Error al enviar nómina a DIAN:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },

    /**
     * Envía un Documento de Soporte (SD) a DIAN vía NextPyme.
     *
     * @async
     * @param {Object} documentData - Payload UBL SD según especificación de NextPyme.
     * @returns {Promise<{statusCode:number, message:string, data?:any, error?:any}>}
     *  - 200: Documento enviado correctamente.
     *  - 400: Error de validación desde NextPyme.
     *  - 500: Error de conexión/servidor.
     * @example
     * const res = await nextPymeService.sendSupportDocumentToDian(sdJson);
     * if (res.statusCode !== 200) console.error(res);
     */
    async sendSupportDocumentToDian(documentData) {
        try {
            const response = await nextPymeConnection.nextPymeRequest('support-document', 'post', documentData);
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al enviar el documento de soporte a DIAN', error: response.message };
                }
                return { statusCode: 400, message: 'Error al enviar el documento de soporte a DIAN', data: response.data };
            }
            return { statusCode: 200, message: 'Documento de soporte enviado a DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.sendSupportDocumentToDian:', error);
            return { statusCode: 500, message: 'Error al enviar el documento de soporte a DIAN', error: error.message };
        }
    },

    /**
     * Envía una Nota de Documento de Soporte (SD Credit Note) a DIAN vía NextPyme.
     *
     * @async
     * @param {Object} documentData - Payload UBL de nota crédito SD (endpoint sd-credit-note).
     * @returns {Promise<{statusCode:number, message:string, data?:any, error?:any}>}
     *  - 200: Envío exitoso, retorna respuesta de NextPyme.
     *  - 400: Error de validación (incluye errores detallados cuando están disponibles).
     *  - 500: Error de conexión/servidor.
     * @example
     * const res = await nextPymeService.sendSupportDocumentNoteToDian(sdNoteJson);
     * console.log(res.statusCode, res.message);
     */
    async sendSupportDocumentNoteToDian(documentData) {
        try {
            const response = await nextPymeConnection.nextPymeRequest('sd-credit-note', 'post', documentData);
            
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al enviar la nota de documento de soporte a DIAN', error: response.message, data : response.data?.errors || response.data?.payload };
                }
                return { statusCode: 400, message: 'Error al enviar la nota de documento de soporte a DIAN', data: response.data.ResponseDian.Envelope.Body.SendBillSyncResponse.SendBillSyncResult.ErrorMessage };
            }
            return { statusCode: 200, message: 'Documento de soporte enviado a DIAN', data: response.data };
        } catch (error) {
            console.log('Error en nextPymeService.sendSupportDocumentToDian:', error);
            return { statusCode: 500, message: 'Error al enviar la nota de documento de soporte a DIAN', error: error.message };
        }
    },
}

module.exports = { nextPymeService };

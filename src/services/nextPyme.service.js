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
            if(!response.success) {
                if(response.error) {
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
}

module.exports = { nextPymeService };

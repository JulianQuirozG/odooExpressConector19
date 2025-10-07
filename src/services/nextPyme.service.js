const config = require("../config/config");
const nextPymeConnection = require("../utils/nextPyme.service");
require('dotenv').config();

const nextPymeService = {
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

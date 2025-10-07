const config = require("../config/config");
const nextPymeConnection = require("../utils/nextPyme.service");
require('dotenv').config();

const nextPymeService = {
    //obtener todos los diarios
    async sendInvoiceToDian(invoiceData) {
        try {
            const response = await nextPymeConnection.nextPymeRequest('invoice-transport', 'post', invoiceData);
            console.log('Respuesta de nextPyme al enviar factura a DIAN:', response);
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

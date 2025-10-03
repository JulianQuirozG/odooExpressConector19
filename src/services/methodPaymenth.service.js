const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

const methodPaymenthService = {
    //obtener todos los métodos de pago
    async getPaymentMethods(paymentMethodFields = ['id', 'name', 'code']) {
        try {
            const response = await odooConector.executeOdooRequest('payment.method', 'search_read', {
                fields: paymentMethodFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener métodos de pago', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener métodos de pago', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de métodos de pago', data: response.data };
        } catch (error) {
            console.log('Error en methodPaymenthService.getPaymentMethods:', error);
            return { statusCode: 500, message: 'Error al obtener métodos de pago', error: error.message };
        }
    },
    //obtener un método de pago por id
    async getOnePaymentMethod(id) {
        try {
            const response = await odooConector.executeOdooRequest('payment.method', 'search_read', {
                domain: [['id', '=', id]],
                fields: ['name', 'code'],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener método de pago', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener método de pago', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Método de pago no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del método de pago', data: response.data[0] };
        } catch (error) {
            console.log('Error en methodPaymenthService.getOnePaymentMethod:', error);
            return { statusCode: 500, message: 'Error al obtener método de pago', error: error.message };
        }
    }
    
}

module.exports = { methodPaymenthService };

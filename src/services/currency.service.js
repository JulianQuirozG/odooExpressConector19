const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

const currencyService = {
    //obtener todas las monedas
    async getCurrency(currencyFields = ['id', 'name']) {
        try {
            const response = await odooConector.executeOdooRequest('res.currency', 'search_read', {
                fields: currencyFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener monedas', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener monedas', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de monedas', data: response.data };
        } catch (error) {
            console.log('Error en currencyService.getCurrency:', error);
            return { statusCode: 500, message: 'Error al obtener monedas', error: error.message };
        }
    },
    //obtener una moneda por id
    async getOneCurrency(id) {
        try {
            const response = await odooConector.executeOdooRequest('res.currency', 'search_read', {
                domain: [['id', '=', id]],
                fields: ['id','name'],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener moneda', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener moneda', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Moneda no encontrada' };
            }
            return { statusCode: 200, message: 'Detalle de la moneda', data: response.data[0] };
        } catch (error) {
            console.log('Error en currencyService.getCurrency:', error);
            return { statusCode: 500, message: 'Error al obtener moneda', error: error.message };
        }
    }
    
}

module.exports = { currencyService };

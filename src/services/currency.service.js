const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

/**
 * Servicio para gestionar monedas (res.currency) en Odoo.
 * Proporciona utilidades para listar y obtener monedas.
 */
const currencyService = {
    /**
     * Obtener la lista de monedas.
     *
     * @async
     * @param {string[]} [currencyFields=['id','name']] - Campos a recuperar por moneda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de monedas) o error.
     */
    async getCurrency(currencyFields = ['id', 'name']) {
        try {
            //Obtenemos todas las monedas
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
    /**
     * Obtener una moneda por su ID.
     *
     * @async
     * @param {number|string} id - ID de la moneda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle de la moneda) o error.
     */
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

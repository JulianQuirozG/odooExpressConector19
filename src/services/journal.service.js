const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

/**
 * Servicio para gestionar diarios (account.journal) en Odoo.
 * Proporciona métodos para listar y obtener diarios.
 */
const journalService = {
    /**
     * Obtener la lista de diarios.
     *
     * @async
     * @param {string[]} [journalFields=['id','name','code','type']] - Campos a recuperar por diario.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de diarios) o error.
     */
    async getJournals(journalFields = ['id','name', 'code', 'type']) {
        try {
            //Obtenemos todos los diarios
            const response = await odooConector.executeOdooRequest('account.journal', 'search_read', {
                fields: journalFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener diarios', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener diarios', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Lista de diarios', data: response.data };
        } catch (error) {
            console.log('Error en journalService.getJournals:', error);
            return { statusCode: 500, message: 'Error al obtener diarios', error: error.message };
        }
    },
    /**
     * Obtener un diario por su ID.
     *
     * @async
     * @param {number|string} id - ID del diario (account.journal).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle del diario) o error.
     */
    async getOneJournal(id) {
        try {
            //Obtenemos el diario por id
            const response = await odooConector.executeOdooRequest('account.journal', 'search_read', {
                domain: [['id', '=', id]],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener diario', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener diario', data: response.data };
            }

            //Si no se encuentra el diario regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Diario no encontrado' };
            }

            //Regresamos la información del diario
            return { statusCode: 200, message: 'Detalle del diario', data: response.data[0] };
        } catch (error) {
            console.log('Error en journalService.getOneJournal:', error);
            return { statusCode: 500, message: 'Error al obtener diario', error: error.message };
        }
    }
    
}

module.exports = { journalService };

const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

const journalService = {
    //obtener todos los diarios
    async getJournals(journalFields = ['id','name', 'code', 'type']) {
        try {
            const response = await odooConector.executeOdooRequest('account.journal', 'search_read', {
                fields: journalFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener diarios', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener diarios', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de diarios', data: response.data };
        } catch (error) {
            console.log('Error en journalService.getJournals:', error);
            return { statusCode: 500, message: 'Error al obtener diarios', error: error.message };
        }
    },
    //obtener un diario por id
    async getOneJournal(id) {
        try {
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
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Diario no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del diario', data: response.data[0] };
        } catch (error) {
            console.log('Error en journalService.getOneJournal:', error);
            return { statusCode: 500, message: 'Error al obtener diario', error: error.message };
        }
    }
    
}

module.exports = { journalService };

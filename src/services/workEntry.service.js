const odooService = require('./../utils/odoo.service');

const workEntryService = {

    async getWorkEntries(domain = []) {
        try {
            // Obtener todas las entradas de trabajo desde Odoo
            const workEntries = await odooService.executeOdooRequest("hr.work.entry", "search_read", { domain, order: 'date asc' });
            if(workEntries.error) return { statusCode: 500, message: 'Error al obtener entradas de trabajo', error: workEntries.error };
            if(!workEntries.success) return { statusCode: 400, message: 'No se pudieron obtener las entradas de trabajo', error: workEntries.message };
            
            //Regreso las entradas de trabajo obtenidas
            return {
                statusCode: 200,
                message: 'Entradas de trabajo obtenidas exitosamente',
                data: workEntries.data
            };
        } catch (error) {
            console.error('Error al obtener las entradas de trabajo desde Odoo', error);
            return {
                statusCode: 500,
                message: 'Error al obtener entradas de trabajo',
                error: error.message
            };
        }
    }
};

module.exports = workEntryService;

const { getTypeLiabilitiesByCode } = require("../Repository/param_type_liabilities/param_type_liabilities.repository");
const odooConector = require("../utils/odoo.service");

const typeLiabilityService = {
    async getTypeLiabilityByid(id) {
        try {
            const typeLiability = await odooConector.executeOdooRequest("l10n_co_edi.type_code", "search_read", { domain: [['id', '=', Number(id)]], limit: 1 });
            
            if (typeLiability.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: typeLiability.data };
            if (!typeLiability.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: typeLiability.data };
            if (typeLiability.data.length === 0) return { statusCode: 404, message: 'Tipo de responsabilidad no encontrado', data: [] };

            return { statusCode: 200, message: 'Tipo de responsabilidad obtenido con éxito', data: typeLiability.data[0] };
        }
        catch (error) {
            console.error('Error al obtener el municipio por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getTypeLiabilityCodeById(id){
        try{
            const typeLiability = await this.getTypeLiabilityByid(id);

            if(typeLiability.statusCode !== 200) return typeLiability;

            const typeLiabilityQuery = await getTypeLiabilitiesByCode(typeLiability.data.name);

            if(!typeLiabilityQuery.success) return {statusCode: 404, message: 'Código del tipo de responsabilidad no encontrado', data:typeLiabilityQuery};
            if(typeLiabilityQuery.data.length ===0) return {statusCode: 404, message: 'Código del tipo de responsabilidad no encontrado', data: []};
            return { statusCode: 200, message: 'Código del tipo de responsabilidad obtenido con éxito', data: typeLiabilityQuery.data };

        }catch(error){
            console.error('Error al obtener el código del tipo de responsabilidad por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { typeLiabilityService };
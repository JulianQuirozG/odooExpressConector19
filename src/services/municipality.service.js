const { getMunicipalityByCode } = require("../Repository/params_municipalities/params_municipalities.repository");
const odooConector = require("../utils/odoo.service");

const municipalityService = {
    async getMunicipalityByid(id) {
        try {
            const city = await odooConector.executeOdooRequest("res.city", "search_read", { domain: [['id', '=', Number(id)]], limit: 1 });

            if (city.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: city.data };
            if (!city.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: city.data };
            if (city.data.length === 0) return { statusCode: 404, message: 'Municipio no encontrado', data: [] };

            return { statusCode: 200, message: 'Municipio obtenido con éxito', data: city.data[0] };
        }
        catch (error) {
            console.error('Error al obtener el municipio por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getMunicipalityCodeById(id){
        try{
            const municipality = await this.getMunicipalityByid(id);

            if(municipality.statusCode !== 200) return municipality;

            console.log('municipality', municipality);

            const city = await getMunicipalityByCode(municipality.data.l10n_co_edi_code);

            if(!city.success) return {statusCode: 404, message: 'Código del municipio no encontrado', data:city};

            return { statusCode: 200, message: 'Código del municipio obtenido con éxito', data: city.data };

        }catch(error){
            console.error('Error al obtener el código del municipio por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { municipalityService };
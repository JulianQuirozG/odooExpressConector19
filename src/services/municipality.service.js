const { getMunicipalityByCode } = require("../Repository/params_municipalities/params_municipalities.repository");
const odooConector = require("../utils/odoo.service");

const municipalityService = {

    /**
     * Obtiene un municipio (res.city) por su ID desde Odoo.
     *
     * @async
     * @param {number|string} id - ID del municipio en Odoo (se convertirá a Number).
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:string}>}
     *  - 200: data contiene el registro encontrado (res.city).
     *  - 404: municipio no encontrado.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await municipalityService.getMunicipalityByid(780);
     * if (res.statusCode === 200) console.log(res.data.name);
     */
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

    /**
     * Obtiene el código estandarizado del municipio (repositorio local) a partir del ID en Odoo.
     *
     * Flujo:
     *  - Lee res.city por ID (getMunicipalityByid).
     *  - Usa l10n_co_edi_code para consultar el repositorio params_municipalities.
     *
     * @async
     * @param {number|string} id - ID del municipio en Odoo.
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:string}>}
     *  - 200: data contiene el código mapeado del repositorio local.
     *  - 404: municipio o código no encontrado.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await municipalityService.getMunicipalityCodeById(780);
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getMunicipalityCodeById(id) {
        try {
            const municipality = await this.getMunicipalityByid(id);

            if (municipality.statusCode !== 200) return municipality;

            const city = await getMunicipalityByCode(municipality.data.l10n_co_edi_code);

            if (!city.success) return { statusCode: 404, message: 'Código del municipio no encontrado', data: city };

            return { statusCode: 200, message: 'Código del municipio obtenido con éxito', data: city.data };

        } catch (error) {
            console.error('Error al obtener el código del municipio por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { municipalityService };
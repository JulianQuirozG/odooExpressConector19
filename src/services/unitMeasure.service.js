const { getUnitMeasureByCode } = require("../Repository/param_unit_measures/params_unit_measures");
const odooConector = require("../utils/odoo.service");

const unitMeasureService = {
    async getUnitMeasureByid(id) {
        try {
            const unitMeasure = await odooConector.executeOdooRequest("uom.uom", "search_read", { domain: [['id', '=', Number(id)]], limit: 1 });

            if (unitMeasure.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: unitMeasure.data };
            if (!unitMeasure.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: unitMeasure.data };
            if (unitMeasure.data.length === 0) return { statusCode: 404, message: 'Documento no encontrado', data: [] };

            return { statusCode: 200, message: 'Documento obtenido con éxito', data: unitMeasure.data[0] };
        }
        catch (error) {
            console.error('Error al obtener el documento por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getUnitMeasureCodeById(id) {
        try {
            const unitMeasure = await this.getUnitMeasureByid(id);

            if (unitMeasure.statusCode !== 200) return unitMeasure;
            if(!unitMeasure.data.l10n_co_edi_ubl) return { statusCode: 404, message: 'La unidad de medida no tiene codigo de estandarizacion para colombia', data: [] };

            const unitMeasureQuery = await getUnitMeasureByCode(unitMeasure.data.l10n_co_edi_ubl);

            if (!unitMeasureQuery.success) return { statusCode: 404, message: 'Código del documento no encontrado', data: unitMeasureQuery };
            if (unitMeasureQuery.length === 0) return { statusCode: 404, message: 'Código del documento no encontrado', data: [] };

            return { statusCode: 200, message: 'Código del documento obtenido con éxito', data: unitMeasureQuery.data };

        } catch (error) {
            console.error('Error al obtener el código del documento por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { unitMeasureService };
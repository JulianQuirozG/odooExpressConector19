const { getTaxByCode } = require("../Repository/param_taxes/params_unit_measures");
const odooConector = require("../utils/odoo.service");

const taxService = {

    /**
     * Obtiene un impuesto (account.tax) por su ID desde Odoo.
     *
     * @async
     * @param {number|string} id - ID del impuesto en Odoo (se convertirá a Number).
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:string}>}
     *  - 200: data contiene el registro de account.tax.
     *  - 404: no se encontró el impuesto.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await taxService.getTaxByid(7);
     * if (res.statusCode === 200) {
     *   console.log(res.data.name);
     * }
     */
    async getTaxByid(id) {
        try {
            const taxOdoo = await odooConector.executeOdooRequest("account.tax", "search_read", { domain: [['id', '=', Number(id)]], limit: 1 });

            if (taxOdoo.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: taxOdoo.data };
            if (!taxOdoo.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: taxOdoo.data };
            if (taxOdoo.data.length === 0) return { statusCode: 404, message: 'Documento no encontrado', data: [] };

            return { statusCode: 200, message: 'Documento obtenido con éxito', data: taxOdoo.data[0] };
        }
        catch (error) {
            console.error('Error al obtener el documento por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },
    /**
     * Obtiene el código estándar (NextPyme/DIAN) asociado al tipo de impuesto (l10n_co_edi.tax.type)
     * de un impuesto dado su ID.
     *
     * Flujo:
     * - Lee el impuesto account.tax por ID.
     * - Toma su campo l10n_co_edi_type y consulta l10n_co_edi.tax.type.
     * - Mapea el code al repositorio local (getTaxByCode).
     *
     * @async
     * @param {number|string} id - ID del impuesto en Odoo.
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:string}>}
     *  - 200: data contiene el código mapeado.
     *  - 404: el impuesto no tiene tipo DIAN o no existe el código.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await taxService.getTaxCodeById(7);
     * if (res.statusCode === 200) {
     *   console.log(res.data); // código estandarizado
     * }
     */
    async getTaxCodeById(id) {
        try {
            const taxData = await this.getTaxByid(id);

            if (taxData.statusCode !== 200) return taxData;
            if (!taxData.data.l10n_co_edi_type) return { statusCode: 404, message: 'La unidad de medida no tiene codigo de estandarizacion para colombia', data: [] };

            const taxTypeData = await odooConector.executeOdooRequest("l10n_co_edi.tax.type", "search_read", { domain: [['id', '=', taxData.data.l10n_co_edi_type[0]]] });

            const unitMeasureQuery = await getTaxByCode(taxTypeData.data[0].code);

            if (!unitMeasureQuery.success) return { statusCode: 404, message: 'Código del documento no encontrado', data: unitMeasureQuery };
            if (unitMeasureQuery.length === 0) return { statusCode: 404, message: 'Código del documento no encontrado', data: [] };

            return { statusCode: 200, message: 'Código del documento obtenido con éxito', data: unitMeasureQuery.data };

        } catch (error) {
            console.error('Error al obtener el código del documento por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { taxService };
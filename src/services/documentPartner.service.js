const { getTypeDocumentByCode } = require("../Repository/params_type_document_identification.repository/params_type_document_identification.repository");
const odooConector = require("../utils/odoo.service");

const documentPartnerService = {

    /**
     * Obtiene el tipo de documento de identificación (l10n_latam.identification.type) por su ID desde Odoo.
     *
     * @async
     * @param {number|string} id - ID del tipo de documento en Odoo (se convertirá a Number).
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:any}>}
     *  - 200: data contiene el registro encontrado.
     *  - 404: no se encontró el tipo de documento.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await documentPartnerService.getDocumentPartnerByid(6);
     * if (res.statusCode === 200) console.log(res.data.name);
     */
    async getDocumentPartnerByid(id) {
        try {
            const city = await odooConector.executeOdooRequest("l10n_latam.identification.type", "search_read", { domain: [['id', '=', Number(id)]], limit: 1 });

            if (city.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: city.data };
            if (!city.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: city.data };
            if (city.data.length === 0) return { statusCode: 404, message: 'Documento no encontrado', data: [] };

            return { statusCode: 200, message: 'Documento obtenido con éxito', data: city.data[0] };
        }
        catch (error) {
            console.error('Error al obtener el documento por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    /**
     * Obtiene el código estandarizado (repositorio local) de un tipo de documento por su ID en Odoo.
     *
     * Flujo:
     *  - Lee l10n_latam.identification.type por ID (getDocumentPartnerByid).
     *  - Usa su id para consultar el repositorio local (getTypeDocumentByCode).
     *
     * @async
     * @param {number|string} id - ID del tipo de documento en Odoo.
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:any}>}
     *  - 200: data contiene el código mapeado del repositorio.
     *  - 404: tipo de documento o código no encontrado en el repositorio.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await documentPartnerService.getDocumentPartnerCodeById(6);
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getDocumentPartnerCodeById(id) {
        try {
            const documentPartner = await this.getDocumentPartnerByid(id);

            if (documentPartner.statusCode !== 200) return documentPartner;
            
            const documentPartnerQuery = await getTypeDocumentByCode(documentPartner.data.id);

            if (!documentPartnerQuery.success) return { statusCode: 404, message: 'Código del documento no encontrado', data: documentPartnerQuery };
            if (documentPartnerQuery.length === 0) return { statusCode: 404, message: 'Código del documento no encontrado', data: [] };

            return { statusCode: 200, message: 'Código del documento obtenido con éxito', data: documentPartnerQuery.data };

        } catch (error) {
            console.error('Error al obtener el código del documento por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { documentPartnerService };
const axios = require('axios');
const config = require('../config/config');
const ODOO_URL = config.odooUrl;
const API_KEY = config.odooApiKey;
const ODOO_DB = config.odooDb;

/**
 * Conector simple para Odoo via HTTP.
 *
 * Construye la URL usando `ODOO_URL`, el `model` y el `method` provistos y realiza
 * una petición POST con cabeceras JSON y la API key (si está configurada).
 *
 * Nota: el conector actual envía la DB en la cabecera `X-Odoo-Database` y asume
 * que el endpoint remoto acepta la forma: `${ODOO_URL}/${model}/${method}`.
 * Si tu instancia de Odoo expone otro endpoint (por ejemplo `/web/dataset/call_kw`),
 * hay que adaptar esta función.
 *
 * @module utils/odooConnector
 */
const odooConector = {

    /**
     * Ejecuta una solicitud a Odoo.
     *
     * @async
     * @param {string} model - Nombre del modelo Odoo (ej. 'sale.order', 'account.move').
     * @param {string} method - Método/acción a invocar en el modelo (ej. 'search_read', 'create', 'write').
     * @param {Object} [args={}] - Payload/argumentos que se enviarán en el body de la petición.
     *                             El contenido exacto depende del endpoint remoto y del método.
     * @returns {Promise<{success:boolean, data?:any, error?:boolean, message?:string}>} Objeto con el resultado:
     *          - success: true en caso de éxito.
     *          - data: respuesta del servicio Odoo cuando success === true.
     *          - error/message: información del error cuando success === false.
     */
    async executeOdooRequest(model, method, args = {}) {
        try {
            const URL = `${ODOO_URL}/${model}/${method}`;
            const request = await axios.post(URL,
                { ...args },
                {
                    headers: {
                        "Content-Type": "application/json",
                        'Authorization': `Bearer ${API_KEY}`,
                        'X-Odoo-Database': `${ODOO_DB}`
                    }
                }
            );
            const data = request.data;
            if (data && data.error || request.response?.status === 500) {
                return { success: false, data: request.response.data?.message ? request.response.data.message : 'Error en la consulta a Odoo' };
            }
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al conectar con Odoo:', error);
            if (error.response) {
                return { success: false, error: true, message: error.response.data?.message || 'Error en la respuesta de Odoo' };
            }
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },

    async createExternalId(externalId, model, resId) {
        try {
            const externalIdResponse = await odooConector.executeOdooRequest('ir.model.data', 'create', {
                vals_list: [{
                    name: externalId,
                    model: model,
                    module: '__custom__',
                    res_id: resId
                }]
            });

            if (!externalIdResponse.success) return { success: false, error: true, message: 'Error al crear external ID en Odoo' };
            return { success: true, data: externalIdResponse.data };
        } catch (error) {
            console.error('Error al crear external ID en Odoo:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    }

}

module.exports = odooConector;

const axios = require('axios');
const config = require('../config/config');
const ODOO_URL = config.odooUrl;
const API_KEY = config.odooApiKey;
const ODOO_DB = config.odooDb;
const odooConector = {
    // Ejecutar una solicitud a Odoo
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

}

module.exports = odooConector;

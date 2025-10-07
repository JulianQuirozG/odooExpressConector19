const axios = require('axios');
const config = require('../config/config');
const NEXTPYME_URL = process.env.NEXTPYME_URL
const NEXTPYME_API_KEY = process.env.NEXTPYME_API_KEY;

const nextPymeConnector = {

    // Ejecutar una solicitud en nextPyme
    async nextPymeRequest(url, method, args = null) {
        try {
            const URL = `${NEXTPYME_URL}/${url}`;
            const request = await axios.request({
                method: `${method}`,
                url: URL,
                data: args,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Bearer ${NEXTPYME_API_KEY}`,
                    "Accept": "application/json"
                }
            });
            const data = request.data;
            if (data && data.error || request.response?.status === 500) {
                return { success: false, data: request.response.data?.message ? request.response.data.message : 'Error en la consulta a nextPyme' };
            }
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al conectar con nextPyme:', error);
            if (error.response) {
                return { success: false, error: true, message: error.response.data?.message || 'Error en la respuesta de nextPyme' };
            }
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },

}

module.exports = nextPymeConnector;

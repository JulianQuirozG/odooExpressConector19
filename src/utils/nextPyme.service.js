const axios = require('axios');
const NEXTPYME_URL = process.env.NEXTPYME_URL
const NEXTPYME_API_KEY = process.env.NEXTPYME_API_KEY;

/**
 * Conector para NextPyme — encapsula llamadas HTTP a la API de NextPyme.
 *
 * Exporta un único método `nextPymeRequest` que construye la URL base, aplica
 * la cabecera de autorización con la API Key y ejecuta la petición usando axios.
 *
 * @module utils/nextPymeConnector
 */
const nextPymeConnector = {

    /**
     * Ejecuta una solicitud HTTP contra NextPyme.
     *
     * - Construye la URL: `${NEXTPYME_URL}/${url}`.
     * - Si el método es GET, envía la petición sin body; en caso contrario, envía `args` como body.
     * - Agrega encabezados: Content-Type, Authorization (Bearer API_KEY) y Accept.
     *
     * @async
     * @param {string} url - Ruta relativa a la API de NextPyme (por ejemplo: 'invoice-transport' o 'download/NIT/FILE').
     * @param {string} method - Método HTTP (GET, POST, PUT, DELETE, ...). No es case-sensitive.
     * @param {Object} [args={}] - Payload para métodos que aceptan body (POST/PUT). Para GET se ignora.
     * @returns {Promise<{success:boolean, data?:any, error?:boolean, message?:string}>} Resultado estandarizado:
     *          - success: true cuando la respuesta fue correcta.
     *          - data: body de la respuesta cuando success === true.
     *          - error/message: información del error cuando success === false.
     */
    async nextPymeRequest(url, method, args = {}) {
        try {
            const URL = `${NEXTPYME_URL}/${url}`;
            let request;
            if (method.toLowerCase() === 'get') {
                request = await axios[`${method}`](URL,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            'Authorization': `Bearer ${NEXTPYME_API_KEY}`,
                            "Accept": "application/json"
                        }
                    }
                );
            } else {
                request = await axios[`${method}`](URL,
                    { ...args },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            'Authorization': `Bearer ${NEXTPYME_API_KEY}`,
                            "Accept": "application/json"
                        }
                    }
                );
            }

            const data = request.data;

            if (data && (data.error || !data.success) || request.response?.status > 300) {
                return { success: false, message: data.message || 'Error en la consulta a nextPyme', data: request.data?.message ? request.data.message : 'Error en la consulta a nextPyme' };
            }
            return { success: true, data: data };
        } catch (error) {
            console.error('Error al conectar con nextPyme:', error);
            if (error.response) {
                return { success: false, error: true, message: error.response.data?.message || 'Error en la respuesta de nextPyme', data: error.response.data || [] };
            }
            return { success: false, error: true, message: 'Error interno del servidor', data: error.response.data || [] };
        }
    },

}

module.exports = nextPymeConnector;

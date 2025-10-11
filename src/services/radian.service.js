const { nextPymeService } = require('./nextPyme.service');

const radianService = {
    /**
     * Envía datos a RADIAN (NextPyme) para registrar un evento o rechazo de documento electrónico.
     * Reglas:
     * - Debe venir al menos uno: event_id o type_rejection_id.
     * - Además, uno de: cufe o par (base64_attacheddocument_name, base64_attacheddocument).
     * - Opcional: referencia de documento en efectivo y datos del emisor (empleado).
     *
     * Construye el payload radianData y delega a nextPymeService.sendRadianData.
     *
     * @async
     * @function sendRadianData
     * @param {Object} data Datos de entrada.
     * @param {number|string} [data.event_id] ID del evento RADIAN (cuando aplique).
     * @param {number|string} [data.type_rejection_id] ID del tipo de rechazo (cuando aplique).
     * @param {string} [data.cufe] CUFE/CUDE del documento de referencia.
     * @param {string} [data.base64_attacheddocument_name] Nombre del archivo adjunto en base64 (si no hay cufe).
     * @param {string} [data.base64_attacheddocument] Contenido base64 del adjunto (si no hay cufe).
     * @param {Object} [data.radianData] Configuración adicional para RADIAN.
     * @param {boolean} [data.radianData.allow_cash_documents] Si permite documentos en efectivo.
     * @param {Object} [data.radianData.document_reference] Referencia del documento (por ejemplo { cufe: string }).
     * @param {Object} [data.employeeData] Datos del emisor (empleado) opcionales.
     * @param {string|number} [data.employeeData.identification_number] Identificación del emisor.
     * @param {string} [data.employeeData.first_name] Nombres del emisor.
     * @param {string} [data.employeeData.last_name] Apellidos del emisor.
     * @param {string} [data.employeeData.organization_department] Departamento.
     * @param {string} [data.employeeData.job_title] Cargo.
     * @returns {Promise<{statusCode:number, message:string, data?:any} | {success:false, error:true, message:string}>}
     *          200 con data de NextPyme; 400 si faltan datos requeridos; 5xx en error interno.
     *
     * @example
     * // Envío con CUFE
     * await radianService.sendRadianData({
     *   event_id: 1,
     *   type_rejection_id: null,
     *   cufe: 'CUFE_O_CUDE_AQUI',
     *   employeeData: {
     *     identification_number: '123456',
     *     first_name: 'Juan',
     *     last_name: 'Pérez',
     *     organization_department: 'Contabilidad',
     *     job_title: 'Analista'
     *   }
     * });
     *
     * @example
     * // Envío con adjunto base64 si no hay CUFE
     * await radianService.sendRadianData({
     *   event_id: null,
     *   type_rejection_id: 2,
     *   base64_attacheddocument_name: 'documento.xml',
     *   base64_attacheddocument: 'BASE64...'
     * });
     */
    async sendRadianData(data) {
        // Lógica para obtener datos de Radian
        try {
            // Simulación de una llamada a un servicio externo
            const radianData = {};

            // validaciones iniciales
            if (!data.event_id && !data.type_rejection_id) return { statusCode: 400, message: 'Para documentos electrónicos es necesario enviar el event_id o el type_rejection_id', data: [] };

            // ID del evento, si aplica
            radianData.event_id = data.event_id;

            // ID del tipo de rechazo, si aplica
            radianData.type_rejection_id = data.type_rejection_id;

            // Permite reiniciar el consecutivo de evento radian
            radianData.resend_consecutive = null;

            // Documento de referencia para enviar el cufe de la fáctura, guarda un objeto {cufe: 'valor del cufe'}
            if (data.cufe) radianData.document_reference = { cufe: data.cufe };

            //si no cuenta con el cufe, puede enviar el documento adjunto en base64
            else if (data.base64_attacheddocument_name && data.base64_attacheddocument) {
                radianData.base64_attacheddocument_name = data.base64_attacheddocument_name;
                radianData.base64_attacheddocument = data.base64_attacheddocument;
            }

            // Si no cuenta con el cufe, y tampoco con el documento adjunto en base64, no se puede enviar la información a Radian
            else return { statusCode: 400, message: 'Para documentos electrónicos es necesario enviar el cufe o el documento adjunto en base64', data: [] };

            // Si el cliente permite documentos en efectivo, se debe enviar la referencia del documento
            if (data.allow_cash_documents) radianData.allow_cash_documents = data.allow_cash_documents;

            //si viene con los datos del empleado se registran
            if (data.employeeData) {
                radianData.issuer_party = {
                    identification_number: data.employeeData.identification_number,
                    first_name: data.employeeData.first_name,
                    last_name: data.employeeData.last_name,
                    organization_department: data.employeeData.organization_department,
                    job_title: data.employeeData.job_title
                };
            }

            const response = await nextPymeService.sendRadianData(radianData);

            // controlo la respuesta

            if (response.statusCode !== 200) {
                return response;
            }

            if(response.data && response.data.ResponseDian.Envelope.Body.SendEventUpdateStatusResponse.SendEventUpdateStatusResult.IsValid){
                return { statusCode: 400, message: 'Error en la respuesta de la Dian', data: response.data.ResponseDian.Envelope.Body.SendEventUpdateStatusResponse.SendEventUpdateStatusResult.ErrorMessage.string };

            }

            return { statusCode: 200, message: 'Radian generado', data: response.data };

        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },
}

module.exports = radianService;
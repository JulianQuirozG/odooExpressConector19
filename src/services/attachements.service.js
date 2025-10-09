const odooConector = require("../utils/odoo.service");

/**
 * Servicio para gestionar adjuntos (ir.attachment) en Odoo.
 * Proporciona métodos para listar, obtener, crear (en varios formatos) y eliminar adjuntos.
 */
const attachementService = {
    /**
     * Obtener attachments filtrando por modelo y/o id de recurso.
     *
     * @async
     * @param {string} [res_model] - Nombre del modelo Odoo (ej. 'account.move'). Si se omite, no filtra por modelo.
     * @param {number|string} [res_id] - ID del registro en el modelo. Si se omite, no filtra por id.
     * @param {string[]} [attachmentFields=['name','mimetype','file_size','res_model','res_id','url']] - Campos a recuperar.
     * @returns {Promise<Object>} Objeto con statusCode, message y data (array de attachments) o error.
     */
    async getAttachments(res_model, res_id, attachmentFields = ['name', 'mimetype', 'file_size', 'res_model', 'res_id', 'url']) {
        try {
            const domain = [];
            if (res_model) {
                domain.push(['res_model', '=', res_model]);
            }
            if (res_id) {
                domain.push(['res_id', '=', res_id]);
            }
            const response = await odooConector.executeOdooRequest('ir.attachment', 'search_read', {
                fields: attachmentFields,
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener attachments', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener attachments', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de attachments', data: response.data };
        } catch (error) {
            console.log('Error en attachementService.getAttachments:', error);
            return { statusCode: 500, message: 'Error al obtener attachments', error: error.message };
        }
    },
    /**
     * Obtener un único adjunto por su ID.
     *
     * @async
     * @param {number|string} id - ID del attachment a recuperar.
     * @returns {Promise<Object>} Objeto con statusCode, message y data (attachment) o error.
     */
    async getOneAttachment(id) {
        try {
            const response = await odooConector.executeOdooRequest('ir.attachment', 'search_read', {
                domain: [['id', '=', Number(id)]],
                fields: ['name', 'mimetype', 'file_size', 'res_model', 'res_id', 'url'],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener adjunto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener adjunto', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Adjunto no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del adjunto', data: response.data[0] };
        } catch (error) {
            console.log('Error en attachementService.getOneAttachment:', error);
            return { statusCode: 500, message: 'Error al obtener adjunto', error: error.message };
        }
    },
    /**
     * Crear un adjunto (ir.attachment) asociado a un registro existente.
     *
     * Proceso:
     *  - Valida que el `model` y `referenceId` existan en Odoo.
     *  - Valida que `file` esté presente y contenga los datos necesarios.
     *  - Construye el objeto `vals` con los campos esperados por Odoo (name, datas, res_model, res_id)
     *    y llama al método 'create' sobre 'ir.attachment'.
     *
     * @async
     * @param {string} model - Modelo Odoo (ej. 'account.move').
     * @param {number|string} referenceId - ID del registro al que se asociará el adjunto.
     * @param {Object} file - Objeto de archivo (por ejemplo, de multer) con { originalname, buffer }.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta de Odoo) o error.
     */
    async createAttachement(model, referenceId, file) {
        try {
            //verifico la factura si viene en el body
            if (!model || !referenceId) {
                return { statusCode: 400, message: 'No se puede crear el adjunto porque falta el modelo o la referencia' };
            }
            const referenceIdResponse = await odooConector.executeOdooRequest(model, 'read', {
                ids: [Number(referenceId)]
            });

            if (!referenceIdResponse.success) {
                if (referenceIdResponse.error) {
                    return { statusCode: 500, message: 'Error al crear el adjunto', error: referenceIdResponse.message };
                }
                return { statusCode: 400, message: 'Error al crear el adjunto', data: referenceIdResponse.data };
            }

            if (referenceIdResponse.data.length === 0) {
                return { statusCode: 404, message: 'No se puede crear el adjunto porque la referencia no existe' };
            }

            // Validar que el archivo esté presente
            if (!file || !file.originalname) {
                return { statusCode: 400, message: 'No se ha proporcionado un archivo válido' };
            }

            const data = {
                name: file.originalname,
                datas: file.buffer.filebase64, // Convertir el buffer a base64
                res_model: model, // Modelo al que se asocia el adjunto
                res_id: Number(referenceId), // ID del registro al que se asocia el adjunto
            }


            const response = await odooConector.executeOdooRequest('ir.attachment', 'create', {
                vals_list: [data]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crears adjunto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear adjunto', data: response.data };
            }
            return { statusCode: 201, message: 'Adjunto creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en attachementService.createAttachement:', error);
            return { statusCode: 500, message: 'Error al crear adjunto', error: error.message };
        }
    },
    /**
     * Crear un adjunto cuyo contenido ya está en formato base64 o texto XML.
     *
     * Este método acepta `file.buffer` como string base64 o como Buffer y lo convierte si es necesario.
     *
     * @async
     * @param {string} model - Modelo Odoo (ej. 'account.move').
     * @param {number|string} referenceId - ID del registro al que se asociará el adjunto.
     * @param {Object} file - Objeto de archivo con { originalname, buffer } donde buffer puede ser string base64 o Buffer.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async createAttachementXML(model, referenceId, file) {
        try {
            //verifico la factura si viene en el body
            if (!model || !referenceId) {
                return { statusCode: 400, message: 'No se puede crear el adjunto porque falta el modelo o la referencia' };
            }
            const referenceIdResponse = await odooConector.executeOdooRequest(model, 'read', {
                ids: [Number(referenceId)]
            });

            if (!referenceIdResponse.success) {
                if (referenceIdResponse.error) {
                    return { statusCode: 500, message: 'Error al crear el adjunto', error: referenceIdResponse.message };
                }
                return { statusCode: 400, message: 'Error al crear el adjunto', data: referenceIdResponse.data };
            }

            if (referenceIdResponse.data.length === 0) {
                return { statusCode: 404, message: 'No se puede crear el adjunto porque la referencia no existe' };
            }

            // Validar que el archivo esté presente
            if (!file || !file.originalname) {
                return { statusCode: 400, message: 'No se ha proporcionado un archivo válido' };
            }

            const data = {
                name: file.originalname,
                datas: typeof file.buffer === 'string' ? file.buffer : Buffer.from(file.buffer).toString('base64'),
                res_model: model, // Modelo al que se asocia el adjunto
                res_id: Number(referenceId), // ID del registro al que se asocia el adjunto
            }


            const response = await odooConector.executeOdooRequest('ir.attachment', 'create', {
                vals_list: [data]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear adjunto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear adjunto', data: response.data };
            }
            return { statusCode: 201, message: 'Adjunto creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en attachementService.createAttachement:', error);
            return { statusCode: 500, message: 'Error al crear adjunto', error: error.message };
        }
    },
    /**
     * Crear un adjunto cuyo contenido es binario (por ejemplo un ZIP).
     *
     * Este método envía `datas` como Buffer o string según el contenido recibido.
     *
     * @async
     * @param {string} model - Modelo Odoo (ej. 'purchase.order').
     * @param {number|string} referenceId - ID del registro al que se asociará el adjunto.
     * @param {Object} file - Objeto de archivo con { originalname, buffer } donde buffer es binario.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async createAttachementZIP(model, referenceId, file) {
        try {
            //verifico la factura si viene en el body
            if (!model || !referenceId) {
                return { statusCode: 400, message: 'No se puede crear el adjunto porque falta el modelo o la referencia' };
            }
            const referenceIdResponse = await odooConector.executeOdooRequest(model, 'read', {
                ids: [Number(referenceId)]
            });

            if (!referenceIdResponse.success) {
                if (referenceIdResponse.error) {
                    return { statusCode: 500, message: 'Error al crear el adjunto', error: referenceIdResponse.message };
                }
                return { statusCode: 400, message: 'Error al crear el adjunto', data: referenceIdResponse.data };
            }

            if (referenceIdResponse.data.length === 0) {
                return { statusCode: 404, message: 'No se puede crear el adjunto porque la referencia no existe' };
            }

            // Validar que el archivo esté presente
            if (!file || !file.originalname) {
                return { statusCode: 400, message: 'No se ha proporcionado un archivo válido' };
            }

            const data = {
                name: file.originalname,
                datas: file.buffer,
                res_model: model, // Modelo al que se asocia el adjunto
                res_id: Number(referenceId), // ID del registro al que se asocia el adjunto
            }


            const response = await odooConector.executeOdooRequest('ir.attachment', 'create', {
                vals_list: [data]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear adjunto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear adjunto', data: response.data };
            }
            return { statusCode: 201, message: 'Adjunto creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en attachementService.createAttachement:', error);
            return { statusCode: 500, message: 'Error al crear adjunto', error: error.message };
        }
    },
    /**
     * Elimina un attachment por ID.
     *
     * @async
     * @param {number|string} id - ID del attachment a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode y message. Si hay error, incluye error o data.
     */
    async deleteAttachment(id) {
        try {
            const attachmentExists = await this.getOneAttachment(id);
            if (attachmentExists.statusCode !== 200) {
                return { statusCode: attachmentExists.statusCode, message: attachmentExists.message, data: attachmentExists.data };
            }
            const response = await odooConector.executeOdooRequest('ir.attachment', 'unlink', {
                ids: [Number(id)]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar adjunto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar adjunto', data: response.data };
            }
            return { statusCode: 200, message: 'Adjunto eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en attachementService.deleteAttachment:', error);
            return { statusCode: 500, message: 'Error al eliminar adjunto', error: error.message };
        }
    },
}

module.exports = attachementService;
const { BILL_FIELDS, PRODUCT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const productService = require("./products.service");

const attachementService = {
    //obtener adjuntos por modelo y id
    async getAttachments(res_model, res_id, attachmentFields = ['name','mimetype', 'file_size', 'res_model', 'res_id','url']) {
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
    //obtener un adjunto por id
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
    //crear un adjunto
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
                datas: file.buffer.toString('base64'),
                res_model: model, // Modelo al que se asocia el adjunto
                res_id: Number(referenceId), // ID del registro al que se asocia el adjunto
                mimetype: file.mimetype,
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
    //eliminar un adjunto
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
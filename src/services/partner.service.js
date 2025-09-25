const { CLIENT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

const partnerService = {
    async getPartners(partnerFields = ['name', 'email', 'phone']) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                fields: partnerFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener partners', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener partners', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de partners', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.getPartners:', error);
            return { statusCode: 500, message: 'Error al obtener partners', error: error.message };
        }
    },
    async getOnePartner(id) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                domain: [['id', '=', id]],
                fields: ['name', 'email', 'phone'],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener partner', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Partner no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del partner', data: response.data[0] };
        } catch (error) {
            console.log('Error en partnerService.getOnePartner:', error);
            return { statusCode: 500, message: 'Error al obtener partner', error: error.message };
        }
    },
    async createPartner(dataPartner) {
        try {
            const partner = pickFields(dataPartner,CLIENT_FIELDS)
            const response = await odooConector.executeOdooRequest('res.partner', 'create', {
                vals_list: [partner]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear partner', data: response.data };
            }
            return { statusCode: 201, message: 'Partner creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.createPartner:', error);
            return { statusCode: 500, message: 'Error al crear partner', error: error.message };
        }
    },
    async updatePartner(id, dataPartner) {
        try {
            const partnerExists = await this.getOnePartner(id);
            if (partnerExists.statusCode !== 200) {
                return { statusCode: partnerExists.statusCode, message: partnerExists.message, data: partnerExists.data};
            }
            const partner = pickFields(dataPartner, CLIENT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner', 'write', {
                ids: [Number(id)],
                vals: partner
            });
            if(!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar partner', data: response.data };
            }
            return { statusCode: 201, message: 'Partner actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.updatePartner:', error);
            return { statusCode: 500, message: 'Error al actualizar partner', error: error.message };
        }
    }, 
    async deletePartner(id) {
        try {
            const partnerExists = await this.getOnePartner(id);
            if (partnerExists.statusCode !== 200) {
                return { statusCode: partnerExists.statusCode, message: partnerExists.message, data: partnerExists.data};
            }
            const response = await odooConector.executeOdooRequest('res.partner', 'unlink', {
                ids: [Number(id)]
            });
            if(!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar partner', data: response.data };
            }
            return { statusCode: 200, message: 'Partner eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en partnerService.deletePartner:', error);
            return { statusCode: 500, message: 'Error al eliminar partner', error: error.message };
        }
    }
}

module.exports = partnerService;
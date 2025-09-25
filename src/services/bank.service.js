const { CLIENT_FIELDS, BANK_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

const bankService = {
    async getBanks(bankFields = ['name', 'bic'], domain = []) {
        try {
            const response = await odooConector.executeOdooRequest('res.bank', 'search_read', {
                fields: bankFields,
                domain: domain
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener bancos', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener bancos', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de bancos', data: response.data };
        } catch (error) {
            console.log('Error en bankService.getBanks:', error);
            return { statusCode: 500, message: 'Error al obtener bancos', error: error.message };
        }
    },
    async getOneBank(id) {
        try {
            const response = await odooConector.executeOdooRequest('res.bank', 'search_read', {
                domain: [['id', '=', id]],
                fields: ['name', 'bic'],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener banco', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Banco no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del banco', data: response.data[0] };
        } catch (error) {
            console.log('Error en bankService.getOneBank:', error);
            return { statusCode: 500, message: 'Error al obtener banco', error: error.message };
        }
    },
    async createBank(dataBank) {
        try {
            const bank = pickFields(dataBank, BANK_FIELDS);
            const response = await odooConector.executeOdooRequest('res.bank', 'create', {
                vals_list: [bank]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear banco', data: response.data };
            }
            return { statusCode: 201, message: 'Banco creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.createBank:', error);
            return { statusCode: 500, message: 'Error al crear banco', error: error.message };
        }
    },
    async updateBank(id, dataBank) {
        try {
            const bankExists = await this.getOneBank(id);
            if (bankExists.statusCode !== 200) {
                return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data};
            }
            const bank = pickFields(dataBank, ['name', 'bic', 'account_number']);
            const response = await odooConector.executeOdooRequest('res.bank', 'write', {
                ids: [Number(id)],
                vals: bank
            });
            if(!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar banco', data: response.data };
            }
            return { statusCode: 201, message: 'Banco actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.updateBank:', error);
            return { statusCode: 500, message: 'Error al actualizar banco', error: error.message };
        }
    },
    async deleteBank(id) {
        try {
            const bankExists = await this.getOneBank(id);
            if (bankExists.statusCode !== 200) {
                return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data};
            }
            const response = await odooConector.executeOdooRequest('res.bank', 'unlink', {
                ids: [Number(id)]
            });
            if(!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar banco', data: response.data };
            }
            return { statusCode: 200, message: 'Banco eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en bankService.deleteBank:', error);
            return { statusCode: 500, message: 'Error al eliminar banco', error: error.message };
        }
    }
}

module.exports = bankService;
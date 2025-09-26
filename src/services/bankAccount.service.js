const { CLIENT_FIELDS, BANK_FIELDS, BANK_ACCOUNT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const bankService = require("./bank.service");
const bankAccountService = {
    async getBanksAccounts(bankFields = ['id', 'display_name', 'partner_id', 'currency_id', 'bank_id']) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                fields: bankFields
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
    async getOneBankAccount(id, bankFields = ['id', 'display_name', 'partner_id', 'currency_id', 'bank_id']) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                domain: [['id', '=', id]],
                fields: bankFields,
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
    async createBankAccount(dataBank) {
        try {
            console.log(dataBank);
            if (dataBank.bank_name) {
                //si viene el nombre del banco lo creo y obtengo el id
                let newBank = {};
                newBank = await bankService.getBanks(['id', 'name'], [['name', 'ilike', dataBank.bank_name]]);
                if (newBank.data.length === 0) {
                    newBank = await bankService.createBank({ name: dataBank.bank_name });
                    if (newBank.statusCode !== 201) {
                        return { statusCode: newBank.statusCode, message: 'No se puede crear la cuenta bancaria porque no se pudo crear el banco', error: newBank.message };
                    }
                }
                dataBank.bank_id = newBank.data[0].id;
            }
            const bank = pickFields(dataBank, BANK_ACCOUNT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'create', {
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
    async updateBankAccount(id, dataBank) {
        try {
            const bankExists = await this.getOneBankAccount(id);
            if (bankExists.statusCode !== 200) {
                return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data };
            }
            const bank = pickFields(dataBank, BANK_ACCOUNT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'write', {
                ids: [Number(id)],
                vals: bank
            });
            if (!response.success) {
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
    async deleteBankAccount(id) {
        try {
            const bankExists = await this.getOneBankAccount(id);
            if (bankExists.statusCode !== 200) {
                return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data };
            }
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'unlink', {
                ids: [Number(id)]
            });
            if (!response.success) {
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

module.exports = bankAccountService;
const { BANK_ACCOUNT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const bankService = require("./bank.service");
/**
 * Servicio para gestionar cuentas bancarias de partners (res.partner.bank) en Odoo.
 * Proporciona métodos para listar, obtener, crear, actualizar y eliminar cuentas bancarias.
 */
const bankAccountService = {
    /**
     * Obtener cuentas bancarias.
     *
     * @async
     * @param {string[]} [bankFields=['id','display_name','partner_id','currency_id','bank_id']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de cuentas) o error.
     */
    async getBanksAccounts(bankFields = ['id', 'display_name', 'partner_id', 'currency_id', 'bank_id']) {
        try {
            //Obtenemos todas las cuentas bancarias
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                fields: bankFields
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener bancos', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener bancos', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Lista de bancos', data: response.data };
        } catch (error) {
            console.log('Error en bankService.getBanks:', error);
            return { statusCode: 500, message: 'Error al obtener bancos', error: error.message };
        }
    },
    /**
     * Obtener una cuenta bancaria por ID.
     *
     * @async
     * @param {number|string} id - ID de la cuenta bancaria.
     * @param {string[]} [bankFields=['id','display_name','partner_id','currency_id','bank_id']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle) o error.
     */
    async getOneBankAccount(id, bankFields = ['id', 'display_name', 'partner_id', 'currency_id', 'bank_id']) {
        try {
            //Obtenemos la cuenta bancaria por id
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                domain: [['id', '=', id]],
                fields: bankFields,
                limit: 1
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener banco', data: response.data };
            }

            //Si no encontramos la cuenta bancaria regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Banco no encontrado' };
            }

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Detalle del banco', data: response.data[0] };
        } catch (error) {
            console.log('Error en bankService.getOneBank:', error);
            return { statusCode: 500, message: 'Error al obtener banco', error: error.message };
        }
    },
    /**
     * Crear una cuenta bancaria para un partner.
     *
     * Si `dataBank.bank_name` está presente, intenta obtener/crear el banco y asignar su ID a `bank_id`.
     *
     * @async
     * @param {Object} dataBank - Datos de la cuenta bancaria, filtrados por `BANK_ACCOUNT_FIELDS`.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta) o error.
     */
    async createBankAccount(dataBank) {
        try {

            //si viene el nombre del banco se verifica si exite, en caso contgrario se crea de forma automática
            if (dataBank.bank_name) {
                let newBank = {};
                newBank = await bankService.getBanks(['id', 'name'], [['name', 'ilike', dataBank.bank_name]]);

                //Si no existe el banco lo creamos
                if (newBank.data.length === 0) {
                    newBank = await bankService.createBank({ name: dataBank.bank_name });
                    if (newBank.statusCode !== 201) {
                        return { statusCode: newBank.statusCode, message: 'No se puede crear la cuenta bancaria porque no se pudo crear el banco', error: newBank.message };
                    }
                }

                //Asignamos el id del banco a bank_id
                dataBank.bank_id = newBank.data[0].id;
            }

            //Filtramos los campos de la cuenta bancaria y la creamos
            const bank = pickFields(dataBank, BANK_ACCOUNT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'create', {
                vals_list: [bank]
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear banco', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 201, message: 'Banco creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.createBank:', error);
            return { statusCode: 500, message: 'Error al crear banco', error: error.message };
        }
    },
    /**
     * Actualizar una cuenta bancaria existente.
     *
     * @async
     * @param {number|string} id - ID de la cuenta a actualizar.
     * @param {Object} dataBank - Campos a actualizar (se filtran con BANK_ACCOUNT_FIELDS).
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async updateBankAccount(id, dataBank) {
        try {
            //Verificamos que la cuenta bancaria exista
            const bankExists = await this.getOneBankAccount(id);
            if (bankExists.statusCode !== 200) return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data };
            
            //Filtramos los campos a actualizar y actualizamos la cuenta bancaria
            const bank = pickFields(dataBank, BANK_ACCOUNT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'write', {
                ids: [Number(id)],
                vals: bank
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar banco', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 201, message: 'Banco actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.updateBank:', error);
            return { statusCode: 500, message: 'Error al actualizar banco', error: error.message };
        }
    },
    /**
     * Eliminar una cuenta bancaria por ID.
     *
     * @async
     * @param {number|string} id - ID de la cuenta a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode y message. Si hay error, incluye error o data.
     */
    async deleteBankAccount(id) {
        try {
            //Verificamos que la cuenta bancaria exista
            const bankExists = await this.getOneBankAccount(id);
            if (bankExists.statusCode !== 200) return bankExists;
            
            //Eliminamos la cuenta bancaria
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'unlink', {
                ids: [Number(id)]
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar banco', data: response.data };
            }

            //Regresamos la respuesta de la eliminación
            return { statusCode: 200, message: 'Banco eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en bankService.deleteBank:', error);
            return { statusCode: 500, message: 'Error al eliminar banco', error: error.message };
        }
    }
}

module.exports = bankAccountService;
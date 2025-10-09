const { BANK_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

/**
 * Servicio para gestionar bancos (res.bank) en Odoo.
 * Proporciona métodos para listar, obtener, crear, actualizar y eliminar bancos.
 */
const bankService = {
    /**
     * Obtener la lista de bancos.
     *
     * @async
     * @param {string[]} [bankFields=['name','bic']] - Campos a recuperar por cada banco.
     * @param {Array} [domain=[]] - Dominio Odoo para filtrar la búsqueda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de bancos) o error.
     */
    async getBanks(bankFields = ['name', 'bic'], domain = []) {
        try {
            //Obtenemos todos los bancos
            const response = await odooConector.executeOdooRequest('res.bank', 'search_read', {
                fields: bankFields,
                domain: domain
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
     * Obtener un banco por su ID.
     *
     * @async
     * @param {number|string} id - ID del banco.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle del banco) o error.
     */
    async getOneBank(id) {
        try {
            //Obtenemos el banco por id
            const response = await odooConector.executeOdooRequest('res.bank', 'search_read', {
                domain: [['id', '=', id]],
                fields: ['name', 'bic'],
                limit: 1
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener banco', data: response.data };
            }

            //Si no encontramos el banco regresamos 404
            if (response.data.length === 0) return { statusCode: 404, message: 'Banco no encontrado' };

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Detalle del banco', data: response.data[0] };
        } catch (error) {
            console.log('Error en bankService.getOneBank:', error);
            return { statusCode: 500, message: 'Error al obtener banco', error: error.message };
        }
    },
    /**
     * Crear un nuevo banco en Odoo.
     *
     * @async
     * @param {Object} dataBank - Objeto con los campos del banco. Se filtrará usando `BANK_FIELDS`.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta) o error.
     */
    async createBank(dataBank) {
        try {
            // Filtramos los campos permitidos para crear un banco y lo creamos
            const bank = pickFields(dataBank, BANK_FIELDS);
            const response = await odooConector.executeOdooRequest('res.bank', 'create', {
                vals_list: [bank]
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear banco', data: response.data };
            }

            //Regresamos la respuesta de la creación
            return { statusCode: 201, message: 'Banco creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.createBank:', error);
            return { statusCode: 500, message: 'Error al crear banco', error: error.message };
        }
    },
    /**
     * Actualizar un banco existente.
     *
     * @async
     * @param {number|string} id - ID del banco a actualizar.
     * @param {Object} dataBank - Campos a actualizar (se filtran: name, bic, account_number).
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async updateBank(id, dataBank) {
        try {
            //Verificamos que el banco exista
            const bankExists = await this.getOneBank(id);
            if (bankExists.statusCode !== 200) return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data };
            
            //Filtramos los campos a actualizar y actualizamos el banco
            const bank = pickFields(dataBank, ['name', 'bic', 'account_number']);
            const response = await odooConector.executeOdooRequest('res.bank', 'write', {
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

            //Regresamos la información de la actualización
            return { statusCode: 201, message: 'Banco actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.updateBank:', error);
            return { statusCode: 500, message: 'Error al actualizar banco', error: error.message };
        }
    },
    /**
     * Eliminar un banco por ID.
     *
     * @async
     * @param {number|string} id - ID del banco a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode y message. Si hay error, incluye error o data.
     */
    async deleteBank(id) {
        try {

            //Verificamos que el banco exista
            const bankExists = await this.getOneBank(id);
            if (bankExists.statusCode !== 200) return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data };
            
            //Eliminamos el banco
            const response = await odooConector.executeOdooRequest('res.bank', 'unlink', {
                ids: [Number(id)]
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar banco', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Banco eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en bankService.deleteBank:', error);
            return { statusCode: 500, message: 'Error al eliminar banco', error: error.message };
        }
    }
}

module.exports = bankService;
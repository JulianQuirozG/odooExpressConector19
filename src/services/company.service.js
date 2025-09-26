// services/company.service.js

const connector = require('../util/odooConector.util.js');

/**
 * Servicio para operaciones con compañías (res.company) en Odoo.
 * @module companyService
 */
const companyService = {

    /**
     * Verifica si una compañía existe por su ID.
     * @async
     * @function companyExists
     * @memberof module:companyService
     * @param {number} companyId - ID de la compañía.
     * @param {Object} user - Usuario autenticado (db, uid, password).
     * @returns {Promise<Object>} Objeto con statusCode, message y data.
     */
    async companyExists(companyId, user) {
        try {
            const domain = [['id', '=', companyId]];
            const fields = ['id', 'name'];
            const companies = await connector.executeOdooQuery("object", "execute_kw", [user.db, user.uid, user.password, 'res.company', 'search_read', [domain], { fields }]);
            if (companies.success === false) {
                if (companies.error === true) {
                    return { statusCode: 500, message: companies.message, data: companies.data };
                }
                return { statusCode: 400, message: companies.message, data: companies.data };
            }
            if (companies.data.length === 0) {
                return { statusCode: 404, message: "La compañía no existe", data: {} };
            }
            return { statusCode: 200, message: "Compañía encontrada", data: companies.data[0] };
        } catch (error) {
            console.error("Error al verificar si la compañía existe:", error);
            return { statusCode: 500, error: true, message: "Error al verificar si la compañía existe", data: [] };
        }

    },

    /**
     * Busca una compañía por nombre.
     * @async
     * @function findCompanyByName
     * @memberof module:companyService
     * @param {string} name - Nombre de la compañía.
     * @param {Object} user - Usuario autenticado (db, uid, password).
     * @returns {Promise<Object>} Objeto con statusCode, message y data.
     */
    async findCompanyByName(name, user) {
        try {
            const domain = [['name', '=', name]];
            const fields = ['id', 'name'];
            const companies = await connector.executeOdooQuery("object", "execute_kw", [user.db, user.uid, user.password, 'res.company', 'search_read', [domain], { fields }]);
            if (companies.success === false) {
                if (companies.error === true) {
                    return { statusCode: 500, message: companies.message, data: companies.data };
                }
                return { statusCode: 400, message: companies.message, data: companies.data };
            }
            if (companies.data.length === 0) {
                return { statusCode: 404, message: "La compañía no existe", data: {} };
            }
            return { statusCode: 200, message: "Compañía encontrada", data: companies.data[0] };
        } catch (error) {
            console.error("Error al buscar la compañía por nombre:", error);
            return { statusCode: 500, error: true, message: "Error al buscar la compañía por nombre", data: [] };
        }

    }
}

module.exports = { companyService };

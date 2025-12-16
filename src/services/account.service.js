const { validate } = require("node-cron");
const odooConector = require("../utils/odoo.service");
const { ACCOUNT_FIELDS } = require("../utils/fields");
const { pickFields } = require("../utils/util");
const accountService = {

    /**
     * Obtiene cuentas contables desde Odoo usando search_read.
     *
     * @async
     * @param {string[]} fields - Lista de campos a recuperar (por ejemplo: ['id','code','name']).
     * @param {Array} domain - Dominio Odoo para filtrar (por ejemplo: [['deprecated','=',false]]).
     * @returns {Promise<{statusCode:number, message:string, data:any[]}>}
     *  - 200: data con la lista de cuentas.
     *  - 400/500: error en la consulta o al conectar con Odoo.
     * @example
     * const res = await accountService.getAccountDetails(['id','code','name'], [['deprecated','=',false]]);
     * if (res.statusCode === 200) console.log(res.data.length);
     */
    async getAccountDetails(fields, domain) {
        // Lógica para obtener detalles de la cuenta
        const response = await odooConector.executeOdooRequest(
            "account.account",
            "search_read",
            {
                fields: fields,
                domain: domain,
            }
        );

        if (response.error) return { statusCode: 500, message: 'Error al obtener las cuentas', data: [] };
        if (!response.success) return { statusCode: 400, message: response.message || 'Error en la consulta de cuentas', data: [] };

        return { statusCode: 200, message: 'Cuentas obtenidas correctamente', data: response.data };
    },

    /**
     * Obtiene una cuenta específica por ID usando search_read.
     *
     * @async
     * @param {number|string} accountId - ID de la cuenta (numérico válido).
     * @param {string[]} fields - Campos a leer (por ejemplo: ['id','code','name']).
     * @param {Array} domain - Dominio adicional a aplicar (se añade ['id','=',accountId]).
     * @returns {Promise<{statusCode:number, message:string, data:any[]}>}
     *  - 200: cuenta encontrada (data con un único registro).
     *  - 404: cuenta no encontrada.
     *  - 400/500: validación o error en la consulta.
     * @example
     * const res = await accountService.getOneAccount(512, ['id','code','name'], []);
     * if (res.statusCode === 200) console.log(res.data[0]);
     */
    async getOneAccount(accountId, fields, domain) {
        // Lógica para obtener una cuenta específica
        if (!Number(accountId)) return { statusCode: 400, message: 'El ID de la cuenta debe ser un número válido', data: [] };

        const response = await odooConector.executeOdooRequest(
            "account.account",
            "search_read",
            {
                fields: fields,
                domain: [...domain, ['id', '=', Number(accountId)]],
            }
        );

        if (response.success && response.data.length === 0) {
            return { statusCode: 404, message: 'Cuenta no encontrada', data: [] };
        }

        return { statusCode: 200, message: 'Cuenta encontrada', data: response.data };
    },

    /**
     * Valida la existencia de una lista de cuentas en Odoo.
     * Acepta IDs numéricos o objetos con propiedad id y retorna los encontrados/no encontrados.
     *
     * @async
     * @param {Array<number|{id:number}>} accountData - Lista de cuentas a validar.
     * @returns {Promise<{
     *   statusCode:number,
     *   message:string,
     *   data:{foundIds:number[], notFoundIds:Array<number|{id:number}>}
     * }>}
     *  - 200: validación completada con arreglos de IDs encontrados/no encontrados.
     *  - 400/500: datos inválidos o error consultando Odoo.
     * @example
     * const res = await accountService.validateAccountList([10, { id: 20 }]);
     * if (res.statusCode === 200) console.log(res.data.foundIds, res.data.notFoundIds);
     */
    async validateAccountList(accountData) {
        // Lógica para validar una lista de cuentas
        try {
            console.log("Validando lista de cuentas:", accountData);
            if (!Array.isArray(accountData) || accountData.length === 0) {
                return { statusCode: 400, message: 'Los datos de la cuenta deben ser una lista no vacía', data: [] };
            }

            accountData.map(acc => {
                if (!acc.id || isNaN(Number(acc.id))) {
                    return { statusCode: 400, message: 'Los datos de la lista deben ser enteros', data: [] };
                }
            });

            const ids = accountData.map(acc => Number(acc));

            const accountIds = await odooConector.executeOdooRequest(
                "account.account",
                "read",
                {
                    ids: ids,
                }
            );

            if (accountIds.error) return { statusCode: 500, message: 'Error al validar las cuentas', data: [] };
            if (!accountIds.success) return { statusCode: 400, message: accountIds.data || 'Error en la consulta de validación de cuentas', data: [] };

            const foundIds = accountIds.data.map(acc => acc.id);
            const notFoundIds = accountData.filter(acc => !foundIds.includes(Number(acc)));

            return { statusCode: 200, message: 'Cuentas validadas correctamente', data: { foundIds, notFoundIds } };

        } catch (error) {
            console.error('Error al validar las cuentas:', error);
            return { statusCode: 500, message: 'Error al validar las cuentas', data: [] };
        }
    },

    /**
     * Crear una nueva cuenta contable en Odoo.
     *
     * @async
     * @param {Object} accountData - Datos de la nueva cuenta (name, code, account_type, etc).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado) o error.
     */
    async createAccount(accountData) {
        try {
            // Validamos que los campos requeridos estén presentes
            if (!accountData.name || !accountData.code || !accountData.account_type) {
                return {
                    statusCode: 400,
                    message: 'Los campos name, code y account_type son requeridos',
                    data: null
                };
            }

            // Filtramos los campos permitidos para crear una cuenta
            const account = pickFields(accountData, ACCOUNT_FIELDS);

            // Ejecutamos la solicitud a Odoo usando el método create
            const response = await odooConector.executeOdooRequest('account.account', 'create', {
                vals_list: [account]
            });

            // Si hay algún error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear la cuenta', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear la cuenta', data: response.data };
            }

            // Regresamos la respuesta de la creación
            return { statusCode: 201, message: 'Cuenta creada con éxito', data: response.data };

        } catch (error) {
            console.error('Error al crear la cuenta:', error);
            return { statusCode: 500, message: 'Error al crear la cuenta', error: error.message };
        }
    },

      
    async getOneAccountByCode(accountCode, fields, domain) {
        // Lógica para obtener una cuenta específica
        if (!Number(accountCode)) return { statusCode: 400, message: 'El código de la cuenta debe ser un número válido', data: [] };

        const response = await odooConector.executeOdooRequest(
            "account.account",
            "search_read",
            {
                fields: fields,
                domain: [...domain, ['code', '=', Number(accountCode)]],
            }
        );

        if (response.success && response.data.length === 0) {
            return { statusCode: 200, message: 'Cuenta no encontrada', data: [] };
        }

        return { statusCode: 200, message: 'Cuenta encontrada', data: response.data };
    },

    
}
module.exports = accountService;
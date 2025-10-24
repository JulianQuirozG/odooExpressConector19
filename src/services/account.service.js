const { validate } = require("node-cron");
const odooConector = require("../utils/odoo.service");
const accountService = {

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
            const notFoundIds = accountData.filter(acc => !foundIds.includes(Number(acc.id))).map(acc => acc.id);

            return { statusCode: 200, message: 'Cuentas validadas correctamente', data: { foundIds, notFoundIds } };

        } catch (error) {
            console.error('Error al validar las cuentas:', error);
            return { statusCode: 500, message: 'Error al validar las cuentas', data: [] };
        }
    }
}
module.exports = accountService;
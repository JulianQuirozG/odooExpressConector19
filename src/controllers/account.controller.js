const accountService = require("../services/account.service");

const accountController = {
    /**
     * Obtener lista de cuentas contables con filtros opcionales.
     */
    async getAccounts(req, res) {
        try {
            const { fields, domain } = req.body;
            const defaultFields = ['id', 'name', 'code', 'account_type'];
            const defaultDomain = [];
            
            const result = await accountService.getAccountDetails(
                fields || defaultFields,
                domain || defaultDomain
            );
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en accountController.getAccounts:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener cuentas', error: error.message });
        }
    },

    /**
     * Obtener una cuenta específica por ID.
     */
    async getOneAccount(req, res) {
        const { id } = req.params;
        try {
            const { fields, domain } = req.body || {};
            const defaultFields = ['id', 'name', 'code', 'account_type', 'reconcile', 'active'];
            const defaultDomain = [];
            
            const result = await accountService.getOneAccount(
                id,
                fields || defaultFields,
                domain || defaultDomain
            );
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en accountController.getOneAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener cuenta', error: error.message });
        }
    },

    /**
     * Crear una nueva cuenta contable.
     */
    async createAccount(req, res) {
        try {
            const result = await accountService.createAccount(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en accountController.createAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear cuenta', error: error.message });
        }
    },

    /**
     * Validar una lista de cuentas.
     */
    async validateAccounts(req, res) {
        try {
            const { accountIds } = req.body;
            
            if (!Array.isArray(accountIds)) {
                return res.status(400).json({
                    statusCode: 400,
                    message: 'accountIds debe ser un arreglo',
                    data: null
                });
            }

            const result = await accountService.validateAccountList(accountIds);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en accountController.validateAccounts:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al validar cuentas', error: error.message });
        }
    },

    /**
     * Obtener una cuenta específica por código.
     */
    async getOneAccountByCode(req, res) {
        const { code } = req.params;
        try {
            const { fields, domain } = req.body || {};
            const defaultFields = ['id', 'name', 'code', 'account_type', 'reconcile', 'active'];
            const defaultDomain = [];
            
            const result = await accountService.getOneAccountByCode(
                code,
                fields || defaultFields,
                domain || defaultDomain
            );
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en accountController.getOneAccountByCode:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener cuenta por código', error: error.message });
        }
    },
};

module.exports = accountController;

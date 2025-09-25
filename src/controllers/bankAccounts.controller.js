const bankAccountsService = require("../services/bankAccount.service");


const bankAccountsController = {
    async getBanksAccounts(req, res) {
        try {
            const result = await bankAccountsService.getBanksAccounts();
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en bankAccountsController.getBanksAccounts:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener las cuentas de banco', error: error.message });
        }
    },
    async getOneBankAccount(req, res) {
        const { id } = req.params;
        try {
            const result = await bankAccountsService.getOneBankAccount(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankAccountsController.getOneBankAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener la cuenta de banco', error: error.message });
        }
    },
    async createBankAccount(req, res) {
        try {
            const result = await bankAccountsService.createBankAccount(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankAccountsController.createBankAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear la cuenta de banco', error: error.message });
        }
    },
    async updateBankAccount(req, res) {
        try{
            const { id } = req.params;
            const result = await bankAccountsService.updateBankAccount(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankAccountsController.updateBankAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar la cuenta de banco', error: error.message });
        }
    },
    async deleteBankAccount(req, res) {
        try {
            const { id } = req.params;
            const result = await bankAccountsService.deleteBankAccount(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankAccountsController.deleteBankAccount:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al eliminar la cuenta de banco', error: error.message });
        }
    },
}

module.exports = bankAccountsController;

const bankService = require("../services/bank.service");


const bankController = {
    async getBanks(req, res) {
        try {
            const result = await bankService.getBanks();
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en bankController.getBanks:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener bancos', error: error.message });
        }
    },
    async getOneBank(req, res) {
        const { id } = req.params;
        try {
            const result = await bankService.getOneBank(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankController.getOneBank:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener banco', error: error.message });
        }
    },
    async createBank(req, res) {
        try {
            const result = await bankService.createBank(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankController.createBank:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear banco', error: error.message });
        }
    },
    async updateBank(req, res) {
        try{
            const { id } = req.params;
            const result = await bankService.updateBank(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankController.updateBank:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar banco', error: error.message });
        }
    },
    async deleteBank(req, res) {
        try {
            const { id } = req.params;
            const result = await bankService.deleteBank(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankController.deleteBank:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al eliminar banco', error: error.message });
        }
    },
    //obtener un banco por coincidencia en el nombre
    async getBankByName(req, res) {
        const { name } = req.query;
        try {
            const result = await bankService.getBanks(['name', 'bic'], [['name', 'ilike', name]]);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en bankController.getBankByName:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener banco por nombre', error: error.message });
        }
    },
}

module.exports = bankController;

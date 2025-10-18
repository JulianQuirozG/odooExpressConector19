const workEntryService = require('../services/workEntry.service');

const workEntryController = {
    // Controlador para obtener todas las entradas de trabajo
    async getWorkEntries(req, res) {
        try {
            const result = await workEntryService.getWorkEntries();
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error al obtener las entradas de trabajo', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener entradas de trabajo', error: error.message });
        }
    },
};

module.exports = workEntryController;

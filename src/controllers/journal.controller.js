
const { journalService } = require("../services/journal.service");

const journalController = {
    async getJournals(req, res) {
        try {
            const result = await journalService.getJournals();
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en journalController.getJournals:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener diarios', error: error.message });
        }
    },
    async getOneJournal(req, res) {
        const { id } = req.params;
        try {
            const result = await journalService.getOneJournal(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en journalController.getOneJournal:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener diario', error: error.message });
        }
    }
}

module.exports = { journalController }; 
const attachementService = require("../services/attachements.service");


const attachementController = {
    async getAttachments(req, res) {
        try {
            const result = await attachementService.getAttachments('move.account',req.params.id);
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en attachementController.getAttachments:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener adjuntos', error: error.message });
        }
    },
    async getOneAttachment(req, res) {
        const { id } = req.params;
        try {
            const result = await attachementService.getOneAttachment(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en attachementController.getOneAttachment:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener adjunto', error: error.message });
        }
    },
    async createAttachment(req, res) {
        try {
            const result = await attachementService.createAttachement('account.move', req.body.id, req.file);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en attachementController.createAttachment:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear adjunto', error: error.message });
        }
    },
    async updateAttachment(req, res) {
        try{
            const { id } = req.params;
            const result = await attachementService.updateAttachment(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en attachementController.updateAttachment:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar adjunto', error: error.message });
        }
    },
    async deleteAttachment(req, res) {
        try {
            const { id } = req.params;
            const result = await attachementService.deleteAttachment(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en attachementController.deleteAttachment:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al eliminar adjunto', error: error.message });
        }
    },
}

module.exports = attachementController;

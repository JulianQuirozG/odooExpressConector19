const { supportDocumentService } = require('../services/supportDocument.service');

const supportDocumentController = {
    async getSupportDocument(req, res) {
        try {
            const result = await supportDocumentService.getSupportDocumentContent();
            return res.status(result.statusCode).json(result);
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },
    async getSupportDocumentById(req, res) {
        const { documentId } = req.params;
        try {
            const result = await supportDocumentService.getSupportDocumentContentById(documentId);
            return res.status(result.statusCode).json(result);
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },
    async createSupportDocument(req, res) {
        const documentData = req.body;
        try {
            const result = await supportDocumentService.createSupportDocument(documentData);
            return res.status(result.statusCode).json(result);
        }
        catch (error) {
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }, 
    async createSupportDocumentJson(req, res) {
        const { documentId } = req.params;
        try {
            const result = await supportDocumentService.createSupportDocumentJson(documentId);
            return res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error al crear el documento JSON de soporte:', error);
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },
    async confirmSupportDocument(req, res) {
        const { documentId } = req.params;
        try {
            const result = await supportDocumentService.confirmSupportDocument(documentId);
            return res.status(result.statusCode).json(result);
        }
        catch (error) {
            console.error('Error al confirmar el documento de soporte:', error);
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
};

module.exports = { supportDocumentController };
const productService = require("../services/products.service");


const productController = {
    async getProducts(req, res) {
        try {
            const result = await productService.getProducts();
            res.status(result.statusCode).json(result);
        }catch (error) {
            console.error('Error en productController.getProducts:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener productos', error: error.message });
        }
    },
    async getOneProduct(req, res) {
        const { id } = req.params;
        try {
            const result = await productService.getOneProduct(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.getOneProduct:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener producto', error: error.message });
        }
    },
    async getProductByExternalId(req, res) {
        const { externalId } = req.params;
        try {
            const { fields } = req.body || {};
            const defaultFields = ['id', 'name', 'default_code', 'list_price'];
            
            const result = await productService.getProductByExternalId(
                externalId,
                fields || defaultFields
            );
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.getProductByExternalId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener producto por external ID', error: error.message });
        }
    },
    async createProduct(req, res) {
        try {
            const result = await productService.createProduct(req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.createProduct:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al crear producto', error: error.message });
        }
    },
    async updateProduct(req, res) {
        try{
            const { id } = req.params;
            const result = await productService.updateProduct(id, req.body);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.updateProduct:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al actualizar producto', error: error.message });
        }
    },
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const result = await productService.deleteProduct(id);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.deleteProduct:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al eliminar producto', error: error.message });
        }
    },
    async getProductByDaneCode(req, res) {
        const { daneCode } = req.params;
        try {
            const { fields } = req.body || {};
            const defaultFields = ['id', 'name', 'default_code', 'x_codigo_dane', 'list_price'];
            
            const result = await productService.getProductByDaneCode(
                daneCode,
                fields || defaultFields
            );
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.getProductByDaneCode:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener producto por código DANE', error: error.message });
        }
    },
    async getExternalIdByProductId(req, res) {
        const { productId } = req.params;
        try {
            const result = await productService.getExternalIdByProductId(productId);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.getExternalIdByProductId:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener external ID del producto', error: error.message });
        }
    },
    async getExternalIdFromDaneCode(req, res) {
        const { daneCode } = req.params;
        try {
            const result = await productService.getExternalIdFromDaneCode(daneCode);
            res.status(result.statusCode).json(result);
        } catch (error) {
            console.error('Error en productController.getExternalIdFromDaneCode:', error);
            res.status(500).json({ statusCode: 500, message: 'Error al obtener external ID del producto', error: error.message });
        }
    }
}

module.exports = productController;

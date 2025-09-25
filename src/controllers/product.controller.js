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
    }
}

module.exports = productController;

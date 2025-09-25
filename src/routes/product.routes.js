const express = require('express');
const productController = require('../controllers/product.controller');
const router = express.Router();

    //Aqui van las rutas de producto
    router.get('/', productController.getProducts);
    router.get('/:id', productController.getOneProduct);
    router.post('/', productController.createProduct);
    router.put('/:id', productController.updateProduct);
    router.delete('/:id', productController.deleteProduct);

module.exports = router;
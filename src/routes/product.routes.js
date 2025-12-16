const express = require('express');
const productController = require('../controllers/product.controller');
const  productSchema  = require('../schemas/product.schema');
const { validateBody } = require('../middleware/validateBody.middleware');
const router = express.Router();

    //Aqui van las rutas de producto
    router.get('/', productController.getProducts);
    router.get('/dane/:daneCode', productController.getProductByDaneCode);
    router.get('/:id', productController.getOneProduct);
    router.post('/', validateBody(productSchema),productController.createProduct);
    router.put('/:id', productController.updateProduct);
    router.delete('/:id', productController.deleteProduct);

module.exports = router;
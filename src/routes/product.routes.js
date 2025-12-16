const express = require('express');
const productController = require('../controllers/product.controller');
const  productSchema  = require('../schemas/product.schema');
const { validateBody } = require('../middleware/validateBody.middleware');
const router = express.Router();

    //Aqui van las rutas de producto
    router.get('/', productController.getProducts);
    router.get('/dane/:daneCode', productController.getProductByDaneCode);
    router.get('/external/:externalId', productController.getProductByExternalId);
    router.get('/external-ids-ilike/:externalIdPattern', productController.getProductsByExternalIdsIlike);
    router.get('/external-id/:productId', productController.getExternalIdByProductId);
    router.get('/external-id-by-dane/:daneCode', productController.getExternalIdFromDaneCode);
    router.get('/:id', productController.getOneProduct);
    router.post('/', validateBody(productSchema),productController.createProduct);
    router.put('/:id', productController.updateProduct);
    router.delete('/:id', productController.deleteProduct);

module.exports = router;
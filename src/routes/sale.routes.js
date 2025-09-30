const express = require("express");
const router = express.Router();

//Controlador
const saleController = require("../controllers/sale.controller");

//Middleware
const {validateBody} = require('../middleware/validateBody.middleware');

//Schema
const createSaleSchema = require('../schemas/Sale/createSale.schema');

router.get('/', saleController.getSales);
router.get('/:id', saleController.getSaleById);
router.post('/', validateBody(createSaleSchema), saleController.createSale);


module.exports = router;


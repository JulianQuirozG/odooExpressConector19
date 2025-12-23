const express = require("express");
const router = express.Router();

//Controlador
const saleController = require("../controllers/sale.controller");

//Middleware
const { validateBody } = require('../middleware/validateBody.middleware');

//Schema
const { createSaleSchema } = require('../schemas/Sale/createSale.schema');
const { validateData } = require("../middleware/createSale.muddleware");
const { controlCron } = require("../middleware/LogLotesFacturas");

//Routes
router.get('/', saleController.getSales);
router.get('/:id', saleController.getSaleById);
router.post('/create-bill', saleController.createBillFromSalesOrder);
router.post('/', saleController.createSale);
router.put('/update-lines', saleController.updateSaleLines);
router.put('/update-lines-remesa', saleController.updateSaleLinesXRemesa);


module.exports = router;


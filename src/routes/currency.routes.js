const express = require("express")
const router = express.Router()
//Controlador
const { currencyController } = require("../controllers/currency.controller")

//Rutas
router.get("/",currencyController.getCurrency)
router.get("/:id",currencyController.getOneCurrency)

module.exports = router
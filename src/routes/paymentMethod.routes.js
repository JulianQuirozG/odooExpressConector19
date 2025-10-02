const express = require("express")
const router = express.Router()
//Controlador
const { paymentMethodController } = require("../controllers/paymentMethod.controller")

//Rutas
router.get("/", paymentMethodController.getPaymentMethods)
router.get("/:id", paymentMethodController.getOnePaymentMethod)

module.exports = router
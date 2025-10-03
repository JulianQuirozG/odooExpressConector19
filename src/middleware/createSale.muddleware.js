const productService = require('../services/products.service');

const validateData = async (req, res, next) => {

    const errors = [];
    
    const { dataVenta, dataCompra } = req.body;

    //ontengo todos los ids de productos de ambas ordenes
    let allProductIds = [
        ...dataVenta.order_line.map(line => line.product_id),
        ...dataCompra.order_line.map(line => line.product_id)
    ];
    // Eliminar IDs duplicados
    allProductIds = [...new Set(allProductIds)];

    const validProducts = await productService.validListId(allProductIds);

    //verificar que los productos existan
    if (validProducts.statusCode !== 200) {
        return res.status(validProducts.statusCode).json(validProducts);
    }

    if(validProducts.data.notFoundIds.length === 0) {
        next();
        return;
    }
    //si hay productos no encontrados, armo el mensaje de error
    errors.push(`Productos no encontrados con IDs: ${validProducts.data.notFoundIds.join(', ')}`);
    return res.status(400).json({ statusCode: 400, message: 'Error de validación', errors });
};

module.exports = { validateData };
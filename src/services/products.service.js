const { PRODUCT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");

const productService = {
    /**
     * Obtener la lista de productos (product.template) desde Odoo.
     *
     * @async
     * @param {string[]} [productFields=['name','default_code','list_price']] - Campos a recuperar por producto.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de productos) o error.
     */
    async getProducts(productFields = ['name', 'default_code', 'list_price']) {
        try {
            const response = await odooConector.executeOdooRequest('product.product', 'search_read', {
                fields: productFields
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener productos', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener productos', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de productos', data: response.data };
        } catch (error) {
            console.log('Error en productService.getProducts:', error);
            return { statusCode: 500, message: 'Error al obtener productos', error: error.message };
        }
    },
    /**
     * Obtener un producto por su ID.
     *
     * @async
     * @param {number|string} id - ID del producto.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle del producto) o error.
     */
    async getOneProduct(id) {
        try {
            const response = await odooConector.executeOdooRequest('product.product', 'search_read', {
                domain: [['id', '=', id]],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener producto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener producto', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Producto no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del producto', data: response.data[0] };
        } catch (error) {
            console.log('Error en productService.getOneProduct:', error);
            return { statusCode: 500, message: 'Error al obtener producto', error: error.message };
        }
    },
    /**
     * Crear un producto (product.template) en Odoo.
     *
     * Si `dataProduct.seller_ids` viene presente, lo mapeará para crear las entradas de proveedores.
     *
     * @async
     * @param {Object} dataProduct - Datos del producto (se filtran por PRODUCT_FIELDS).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta) o error.
     */
    async createProduct(dataProduct) {
        try {
            const product = pickFields(dataProduct, PRODUCT_FIELDS);

            //si el json viene con seller_ids lo mapeo para verificar si viene con los paramatros para crear a los proveedores
            if(dataProduct.seller_ids?.length > 0){
                //cada vendedor debe ser un array con la estructura [0, 0, {vals}], para que al crear el registro se creen las lines de proveedores
                product.seller_ids = dataProduct.seller_ids.map((seller) => { return [0, 0, seller]});
            }
            
            const response = await odooConector.executeOdooRequest('product.product', 'create', {
                vals_list: [product]
            });

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear producto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear producto', data: response.data };
            }

            return { statusCode: 201, message: 'Producto creado con éxito', data: response.data };
        
        } catch (error) {
            console.log('Error en productService.createProduct:', error);
            return { statusCode: 500, message: 'Error al crear producto', error: error.message };
        }
    },
    /**
     * Actualizar un producto existente.
     *
     * @async
     * @param {number|string} id - ID del producto a actualizar.
     * @param {Object} dataProduct - Campos a actualizar (filtrados por PRODUCT_FIELDS).
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async updateProduct(id, dataProduct) {
        try {
            const productExists = await this.getOneProduct(id);
            if (productExists.statusCode !== 200) {
                return { statusCode: productExists.statusCode, message: productExists.message, data: productExists.data };
            }
            const product = pickFields(dataProduct, PRODUCT_FIELDS);
            const response = await odooConector.executeOdooRequest('product.template', 'write', {
                ids: [Number(id)],
                vals: product
            });
            if(!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar producto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar producto', data: response.data };
            }
            return { statusCode: 201, message: 'Producto actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en productService.updateProduct:', error);
            return { statusCode: 500, message: 'Error al actualizar producto', error: error.message };
        }
    },
    /**
     * Eliminar un producto por ID.
     *
     * @async
     * @param {number|string} id - ID del producto a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async deleteProduct(id) {
        try {
            const productExists = await this.getOneProduct(id);
            if (productExists.statusCode !== 200) {
                return { statusCode: productExists.statusCode, message: productExists.message, data: productExists.data};
            }
            const response = await odooConector.executeOdooRequest('product.template', 'unlink', {
                ids: [Number(id)]
            });
            if(!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar producto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar producto', data: response.data };
            }
            return { statusCode: 200, message: 'Producto eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en productService.deleteProduct:', error);
            return { statusCode: 500, message: 'Error al eliminar producto', error: error.message };
        }
    },
    /**
     * Validar una lista de IDs de productos: devuelve los encontrados y los no encontrados.
     *
     * @async
     * @param {number[]} ids - Array de IDs a validar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data { foundIds, notFoundIds } o error.
     */
    async validListId(ids){
        try {
            const response = await odooConector.executeOdooRequest('product.product', 'read', {
                ids: ids,
                fields: ['id', "name"]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al validar productos', error: response.message };
                }
                return { statusCode: 400, message: 'Error al validar productos', data: response.data };
            }
            const foundIds = response.data.map(item => item.id);
            const notFoundIds = ids.filter(id => !foundIds.includes(id));
            return { statusCode: 200, message: 'Validación de productos', data: { foundIds, notFoundIds } };
        } catch (error) {
            console.log('Error en productService.validListId:', error);
            return { statusCode: 500, message: 'Error al validar productos', error: error.message };
        }
    }
}

module.exports = productService;
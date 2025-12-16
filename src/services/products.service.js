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
     * Obtener productos por un patrón de external ID (búsqueda ILIKE).
     *
     * @async
     * @param {string} externalIdPattern - Patrón de external ID a buscar (ej: "product_%" o "prod").
     * @param {string[]} [fields=['id','name','default_code','list_price']] - Campos a recuperar de los productos.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de productos encontrados) o error.
     *  - 200: productos encontrados.
     *  - 404: ningún producto coincide con el patrón.
     *  - 400/500: error en la consulta o validación.
     * @example
     * const res = await productService.getProductsByExternalIdsIlike('product_');
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getProductsByExternalIdsIlike(externalIdPattern, fields = ['id', 'name', 'default_code', 'list_price']) {
        try {
            // Validamos que el patrón de external ID no esté vacío
            if (!externalIdPattern || externalIdPattern.toString().trim() === '') {
                return { statusCode: 400, message: 'El patrón de external ID es requerido', data: [] };
            }

            // Primero buscamos en ir.model.data los external IDs que coincidan con el patrón
            const externalIdsResponse = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', 'ilike', `%${externalIdPattern.toString().trim()}%`], ['model', '=', 'product.product']],
                fields: ['id', 'name', 'res_id', 'model']
            });

            // Si hay algún error lo gestionamos
            if (!externalIdsResponse.success) {
                if (externalIdsResponse.error) {
                    return { statusCode: 500, message: 'Error al buscar external IDs', error: externalIdsResponse.message };
                }
                return { statusCode: 400, message: 'Error al buscar external IDs', data: [] };
            }

            // Si no encontramos external IDs regresamos 404
            if (externalIdsResponse.data.length === 0) {
                return { statusCode: 404, message: 'Ningún producto encontrado con ese patrón de external ID', data: [] };
            }

            // Extraemos los IDs de los productos (res_id)
            const productIds = externalIdsResponse.data.map(item => item.res_id);

            // Ahora obtenemos los productos con esos IDs
            const productsResponse = await odooConector.executeOdooRequest('product.product', 'search_read', {
                domain: [['id', 'in', productIds]],
                fields: fields
            });
          
            // Si hay algún error lo gestionamos
            if (!productsResponse.success) {
                if (productsResponse.error) {
                    return { statusCode: 500, message: 'Error al obtener productos', error: productsResponse.message };
                }
                return { statusCode: 400, message: 'Error al obtener productos', data: [] };
            }

            // Si no encontramos productos regresamos 404
            if (productsResponse.data.length === 0) {
                return { statusCode: 404, message: 'Ningún producto encontrado con ese patrón de external ID', data: [] };
            }

            //Ahora añadimos a al objeto de respuesta los external IDs correspondientes a cada producto
            const productsWithExternalIds = productsResponse.data.map(product => {
                const externalIdEntry = externalIdsResponse.data.find(item => item.res_id === product.id);
                return {
                    ...product,
                    external_id: externalIdEntry ? externalIdEntry.name : null
                };
            });

            // Regresamos los productos encontrados
            return { statusCode: 200, message: 'Productos encontrados por patrón de external ID', data: productsWithExternalIds };
        } catch (error) {
            console.log('Error en productService.getProductsByExternalIdsIlike:', error);
            return { statusCode: 500, message: 'Error al obtener productos por patrón de external ID', error: error.message };
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
     * Obtener un producto por su external ID.
     *
     * @async
     * @param {string} externalId - External ID del producto (nombre único).
     * @param {string[]} [fields=['id','name','default_code','list_price']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle del producto) o error.
     *  - 200: producto encontrado.
     *  - 404: producto no encontrado.
     *  - 400/500: error en la consulta o validación.
     * @example
     * const res = await productService.getProductByExternalId('product_123');
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getProductByExternalId(externalId, fields = ['id', 'name', 'default_code', 'list_price']) {
        try {
            // Validamos que el external ID no esté vacío
            if (!externalId || externalId.toString().trim() === '') {
                return { statusCode: 400, message: 'El external ID es requerido', data: null };
            }

            // Primero obtenemos el registro de ir.model.data con ese external ID
            const externalIdResponse = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', externalId.toString().trim()], ['model', '=', 'product.product']],
                fields: ['id', 'name', 'res_id', 'model'],
                limit: 1
            });

            // Si hay algún error lo gestionamos
            if (!externalIdResponse.success) {
                if (externalIdResponse.error) {
                    return { statusCode: 500, message: 'Error al buscar external ID', error: externalIdResponse.message };
                }
                return { statusCode: 400, message: 'Error al buscar external ID', data: externalIdResponse.data };
            }

            // Si no encontramos el external ID regresamos 404
            if (externalIdResponse.data.length === 0) {
                return { statusCode: 404, message: 'Producto no encontrado con ese external ID', data: null };
            }

            // Obtenemos el res_id (ID del producto)
            const productId = externalIdResponse.data[0].res_id;

            // Ahora obtenemos el producto con ese ID
            const productResponse = await odooConector.executeOdooRequest('product.product', 'search_read', {
                domain: [['id', '=', productId]],
                fields: fields,
                limit: 1
            });

            // Si hay algún error lo gestionamos
            if (!productResponse.success) {
                if (productResponse.error) {
                    return { statusCode: 500, message: 'Error al obtener producto', error: productResponse.message };
                }
                return { statusCode: 400, message: 'Error al obtener producto', data: productResponse.data };
            }

            // Si no encontramos el producto regresamos 404
            if (productResponse.data.length === 0) {
                return { statusCode: 404, message: 'Producto no encontrado', data: null };
            }

            // Regresamos el producto encontrado
            return { statusCode: 200, message: 'Producto encontrado', data: productResponse.data[0] };
        } catch (error) {
            console.log('Error en productService.getProductByExternalId:', error);
            return { statusCode: 500, message: 'Error al obtener producto por external ID', error: error.message };
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
    },

    /**
     * Obtener un producto por su código DANE (x_codigo_dane).
     *
     * @async
     * @param {string} daneCode - Código DANE a buscar (valor de texto).
     * @param {string[]} [fields=['id','name','default_code','x_codigo_dane','list_price']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (producto encontrado) o error.
     *  - 200: producto encontrado.
     *  - 404: producto no encontrado.
     *  - 400/500: error en la consulta o validación.
     * @example
     * const res = await productService.getProductByDaneCode('10000000');
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getProductByDaneCodeIlike(daneCode, fields = ['id', 'name', 'default_code', 'x_codigo_dane', 'list_price']) {
        try {
            // Validamos que el código DANE no esté vacío
            if (!daneCode || daneCode.toString().trim() === '') {
                return { statusCode: 400, message: 'El código DANE es requerido', data: null };
            }
            console.log('Buscando producto con código DANE:', daneCode);
            // Ejecutamos la búsqueda con filtro exacto por código DANE
            const response = await odooConector.executeOdooRequest('product.product', 'search_read', {
                domain: [['x_codigo_dane', 'ilike', `%${daneCode.toString().trim()}%`]],
                fields: fields
            });

            // Si hay algún error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener producto por código DANE', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener producto por código DANE', data: response.data };
            }

            // Si no encontramos el producto regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Producto no encontrado con ese código DANE', data: null };
            }

            // Regresamos el producto encontrado
            return { statusCode: 200, message: 'Producto encontrado', data: response.data };
        } catch (error) {
            console.log('Error en productService.getProductByDaneCode:', error);
            return { statusCode: 500, message: 'Error al obtener producto por código DANE', error: error.message };
        }
    },

    /**
     * Obtener un producto por su código DANE (x_codigo_dane).
     *
     * @async
     * @param {string} daneCode - Código DANE a buscar (valor de texto).
     * @param {string[]} [fields=['id','name','default_code','x_codigo_dane','list_price']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (producto encontrado) o error.
     *  - 200: producto encontrado.
     *  - 404: producto no encontrado.
     *  - 400/500: error en la consulta o validación.
     * @example
     * const res = await productService.getProductByDaneCode('10000000');
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getProductByDaneCode(daneCode, fields = ['id', 'name', 'default_code', 'x_codigo_dane', 'list_price']) {
        try {
            // Validamos que el código DANE no esté vacío
            if (!daneCode || daneCode.toString().trim() === '') {
                return { statusCode: 400, message: 'El código DANE es requerido', data: null };
            }
            console.log('Buscando producto con código DANE:', daneCode);
            // Ejecutamos la búsqueda con filtro exacto por código DANE
            const response = await odooConector.executeOdooRequest('product.product', 'search_read', {
                domain: [['x_codigo_dane', '=', `${daneCode.toString().trim()}`]],
                fields: fields
            });

            // Si hay algún error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener producto por código DANE', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener producto por código DANE', data: response.data };
            }

            // Si no encontramos el producto regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Producto no encontrado con ese código DANE', data: null };
            }

            // Regresamos el producto encontrado
            return { statusCode: 200, message: 'Producto encontrado', data: response.data };
        } catch (error) {
            console.log('Error en productService.getProductByDaneCode:', error);
            return { statusCode: 500, message: 'Error al obtener producto por código DANE', error: error.message };
        }
    },

    /**
     * Obtener el external ID de un producto por su ID.
     *
     * @async
     * @param {number|string} productId - ID del producto en Odoo.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (external ID encontrado) o error.
     *  - 200: external ID encontrado.
     *  - 404: producto sin external ID.
     *  - 400/500: error en la consulta o validación.
     * @example
     * const res = await productService.getExternalIdByProductId(123);
     * if (res.statusCode === 200) console.log(res.data.name);
     */
    async getExternalIdByProductId(productId) {
        try {
            // Validamos que el ID del producto sea válido
            if (!productId || isNaN(Number(productId))) {
                return { statusCode: 400, message: 'El ID del producto debe ser un número válido', data: null };
            }

            // Ejecutamos la búsqueda del external ID en ir.model.data
            const response = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['model', '=', 'product.product'], ['res_id', '=', Number(productId)]],
                fields: ['id', 'name', 'module', 'model', 'res_id'],
                limit: 1
            });

            // Si hay algún error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener external ID del producto', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener external ID del producto', data: response.data };
            }

            // Si no encontramos el external ID regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'El producto no tiene un external ID asociado', data: null };
            }

            // Regresamos el external ID encontrado
            return { statusCode: 200, message: 'External ID encontrado', data: response.data[0] };
        } catch (error) {
            console.log('Error en productService.getExternalIdByProductId:', error);
            return { statusCode: 500, message: 'Error al obtener external ID del producto', error: error.message };
        }
    },

    /**
     * Obtener el external ID de un producto por su código DANE.
     *
     * @async
     * @param {string} daneCode - Código DANE del producto.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (external ID encontrado) o error.
     *  - 200: external ID encontrado.
     *  - 404: producto no encontrado o sin external ID.
     *  - 400/500: error en la consulta o validación.
     * @example
     * const res = await productService.getExternalIdFromDaneCode('10000000');
     * if (res.statusCode === 200) console.log(res.data.name);
     */
    async getExternalIdFromDaneCode(daneCode) {
        try {
            // Primero obtenemos el producto por código DANE
            const productResponse = await this.getProductByDaneCode(daneCode, ['id']);
            console.log('Respuesta de getProductByDaneCode:', productResponse);
            if (productResponse.statusCode !== 200) {
                return { statusCode: 404, message: 'Producto no encontrado con ese código DANE', data: null };
            }
            
            // Obtenemos el ID del producto encontrado
            const productId = productResponse.data[0].id;
            
            // Ahora obtenemos el external ID del producto
            const externalIdResponse = await this.getExternalIdByProductId(productId);
            return externalIdResponse;
        } catch (error) {
            console.log('Error en productService.getExternalIdFromDaneCode:', error);
            return { statusCode: 500, message: 'Error al obtener external ID del producto', error: error.message };
        }
    }
}

module.exports = productService;
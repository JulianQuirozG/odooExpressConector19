const { getTypeLiabilitiesByCode } = require("../Repository/param_type_liabilities/param_type_liabilities.repository");
const odooConector = require("../utils/odoo.service");
const paramsPaymentMethodsRepository = require("../Repository/params_payment_methods/params_payment_methods.repository");

const paymentMethodService = {
    /**
     * Obtiene un método de pago (l10n_co_edi.payment.option) por su ID desde Odoo.
     *
     * @async
     * @param {number|string} id - ID del método de pago en Odoo (se convertirá a Number).
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:any}>}
     *  - 200: data contiene el registro encontrado.
     *  - 404: no se encontró el método de pago.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await paymentMethodService.getPaymentMethodById(66);
     * if (res.statusCode === 200) console.log(res.data.code);
     */
    async getPaymentMethodById(id) {
        try {
            const paymentMethod = await odooConector.executeOdooRequest("l10n_co_edi.payment.option", "search_read", { domain: [['id', '=', Number(id)]], limit: 1 });

            if (paymentMethod.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: paymentMethod.data };
            if (!paymentMethod.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: paymentMethod.data };
            if (paymentMethod.data.length === 0) return { statusCode: 404, message: 'Método de pago no encontrado', data: [] };

            return { statusCode: 200, message: 'Método de pago obtenido con éxito', data: paymentMethod.data[0] };
        }
        catch (error) {
            console.error('Error al obtener el método de pago por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    /**
     * Obtiene el código estándar (repositorio local) de un método de pago por su ID en Odoo.
     *
     * Flujo:
     *  - Lee l10n_co_edi.payment.option por ID (getPaymentMethodById).
     *  - Mapea su code en params_payment_methods (repositorio local).
     *
     * @async
     * @param {number|string} id - ID del método de pago en Odoo.
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:any}>}
     *  - 200: data contiene el registro mapeado del repositorio.
     *  - 404: el método o su código no existe en el repositorio.
     *  - 400/500: error en la solicitud o del servidor.
     * @example
     * const res = await paymentMethodService.getPaymentMethodCodeById(66);
     * if (res.statusCode === 200) console.log(res.data);
     */
    async getPaymentMethodCodeById(id){
        try{
            const paymentMethod = await this.getPaymentMethodById(id);

            if(paymentMethod.statusCode !== 200) return paymentMethod;


            const paymentMethodQuery = await  paramsPaymentMethodsRepository.getPaymentMethodByCode(paymentMethod.data.code);

            if(!paymentMethodQuery.success) return {statusCode: 404, message: 'Código del método de pago no encontrado', data:paymentMethodQuery};
            if(paymentMethodQuery.data.length ===0) return {statusCode: 404, message: 'Código del método de pago no encontrado', data: []};
            
            return { statusCode: 200, message: 'Código del método de pago obtenido con éxito', data: paymentMethodQuery.data };

        }catch(error){
            console.error('Error al obtener el código del método de pago por ID:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { paymentMethodService };
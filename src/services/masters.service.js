const { get } = require("../app");
const odooConector = require("../utils/odoo.service");

const mastersService = {
    async getContries() {
        try {
            const countries = await odooConector.executeOdooRequest("res.country", "search_read", {fields: ["id", "name", "code"]});

            if (countries.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: countries.data };
            if (!countries.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: countries.data };
            return { statusCode: 200, message: 'Paises obtenidos con éxito', data: countries.data };
        }
        catch (error) {
            console.error('Error al obtener los paises:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getStatesByCountryId(countryId) {
        try {
            const states = await odooConector.executeOdooRequest("res.country.state", "search_read", {domain: [['country_id', '=', Number(countryId)]], fields: ['id', 'name', 'code']});
            if (states.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: states.data };
            if (!states.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: states.data };

            return { statusCode: 200, message: 'Estados obtenidos con éxito', data: states.data };
        }catch (error) {
            console.error('Error al obtener los estados por país:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getCityByStateId(stateId) {
        try {
            const cities = await odooConector.executeOdooRequest("res.city", "search_read", {domain: [['state_id', '=', Number(stateId)]], fields: ['id', 'name']});
            if (cities.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: cities.data };
            if (!cities.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: cities.data };
            return { statusCode: 200, message: 'Ciudades obtenidas con éxito', data: cities.data };
        } catch (error) {
            console.error('Error al obtener las ciudades por estado:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getPaymentTermsPartner() {
        try {
            const paymentTerms = await odooConector.executeOdooRequest("account.payment.term", "search_read", {fields: ["id", "name", "note"]});
            if (paymentTerms.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: paymentTerms.data };
            if (!paymentTerms.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: paymentTerms.data };
            return { statusCode: 200, message: 'Términos de pago obtenidos con éxito', data: paymentTerms.data };
        } catch (error) {
            console.error('Error al obtener los términos de pago:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getFiscalObligations() {
        try {
            const fiscalObligations = await odooConector.executeOdooRequest("l10n_co_edi.type_code", "search_read", {fields: ["id", "name", "description"]});
            if (fiscalObligations.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: fiscalObligations.data };
            if (!fiscalObligations.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: fiscalObligations.data };
            return { statusCode: 200, message: 'Obligaciones fiscales obtenidas con éxito', data: fiscalObligations.data };
        } catch (error) {
            console.error('Error al obtener las obligaciones fiscales:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getFiscalRegimes() {
        try {
            let fiscalRegimes = await odooConector.executeOdooRequest("res.partner", "fields_get", {});
           
            if (fiscalRegimes.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: fiscalRegimes.data };
            if (!fiscalRegimes.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: fiscalRegimes.data };
             fiscalRegimes = fiscalRegimes.data.l10n_co_edi_fiscal_regimen.selection;
             console.log(fiscalRegimes);
            return { statusCode: 200, message: 'Regímenes fiscales obtenidos con éxito', data: fiscalRegimes };
        } catch (error) {
            console.error('Error al obtener los regímenes fiscales:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    },

    async getPaymentMethodsPartner() {
        try {
            const paymentMethods = await odooConector.executeOdooRequest("account.payment.method.line", "search_read", {fields: ["id", "name", "display_name"], domain: [['payment_type', '=', 'inbound']], "context": { "lang": "es_CO" }});
            if (paymentMethods.error) return { statusCode: 500, message: 'Error al conectar con Odoo', error: paymentMethods.data };
            if (!paymentMethods.success) return { statusCode: 400, message: 'Error en la solicitud a Odoo', data: paymentMethods.data };
            return { statusCode: 200, message: 'Métodos de pago obtenidos con éxito', data: paymentMethods.data };
        } catch (error) {
            console.error('Error al obtener los métodos de pago:', error);
            return { statusCode: 500, message: 'Error interno del servidor', error: error.message };
        }
    }
}

module.exports = { mastersService };
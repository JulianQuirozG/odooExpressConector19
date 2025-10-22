const { CLIENT_FIELDS, BANK_ACCOUNT_PARTNER_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const bankAccountService = require("./bankAccount.service");

const partnerService = {
    /**
     * Obtener la lista de partners (res.partner) desde Odoo.
     *
     * @async
     * @param {string[]} [partnerFields=['name','email','phone']] - Campos a recuperar por partner.
     * @param {Array} [domain=[]] - Dominio Odoo para filtrar la búsqueda.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de partners) o error.
     */
    async getPartners(partnerFields = ['name', 'email', 'phone'], domain = []) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                domain: domain
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener partners', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener partners', data: response.data };
            }
            return { statusCode: 200, message: 'Lista de partners', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.getPartners:', error);
            return { statusCode: 500, message: 'Error al obtener partners', error: error.message };
        }
    },
    /**
     * Obtener un partner por su ID.
     *
     * @async
     * @param {number|string} id - ID del partner a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle del partner) o error.
     */
    async getOnePartner(id) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                domain: [['id', '=', id]],
                limit: 1
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener partner', data: response.data };
            }
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Partner no encontrado' };
            }
            return { statusCode: 200, message: 'Detalle del partner', data: response.data[0] };
        } catch (error) {
            console.log('Error en partnerService.getOnePartner:', error);
            return { statusCode: 500, message: 'Error al obtener partner', error: error.message };
        }
    },
    /**
     * Crear un nuevo partner (res.partner) en Odoo.
     *
     * @async
     * @param {Object} dataPartner - Datos del partner. Se filtran por CLIENT_FIELDS.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta) o error.
     */
    async createPartner(dataPartner) {
        try {
            const partner = pickFields(dataPartner, CLIENT_FIELDS)
            const response = await odooConector.executeOdooRequest('res.partner', 'create', {
                vals_list: [partner]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear partner', data: response.data };
            }
            return { statusCode: 201, message: 'Partner creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.createPartner:', error);
            return { statusCode: 500, message: 'Error al crear partner', error: error.message };
        }
    },
    /**
     * Actualizar un partner existente.
     *
     * @async
     * @param {number|string} id - ID del partner a actualizar.
     * @param {Object} dataPartner - Campos a actualizar (filtrados por CLIENT_FIELDS).
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async updatePartner(id, dataPartner) {
        try {
            const partnerExists = await this.getOnePartner(id);
            if (partnerExists.statusCode !== 200) {
                return { statusCode: partnerExists.statusCode, message: partnerExists.message, data: partnerExists.data };
            }
            const partner = pickFields(dataPartner, CLIENT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner', 'write', {
                ids: [Number(id)],
                vals: partner
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar partner', data: response.data };
            }
            return { statusCode: 201, message: 'Partner actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.updatePartner:', error);
            return { statusCode: 500, message: 'Error al actualizar partner', error: error.message };
        }
    },
    /**
     * Eliminar un partner por ID.
     *
     * @async
     * @param {number|string} id - ID del partner a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode y message. Si hay error, incluye error o data.
     */
    async deletePartner(id) {
        try {
            const partnerExists = await this.getOnePartner(id);
            if (partnerExists.statusCode !== 200) {
                return { statusCode: partnerExists.statusCode, message: partnerExists.message, data: partnerExists.data };
            }
            const response = await odooConector.executeOdooRequest('res.partner', 'unlink', {
                ids: [Number(id)]
            });
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar partner', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar partner', data: response.data };
            }
            return { statusCode: 200, message: 'Partner eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en partnerService.deletePartner:', error);
            return { statusCode: 500, message: 'Error al eliminar partner', error: error.message };
        }
    },
    /**
     * Crear un partner y, opcionalmente, cuentas bancarias asociadas.
     *
     * Proceso:
     *  - Crea el partner usando `createPartner`.
     *  - Crea las cuentas bancarias indicadas en `dataPartner.bankAccounts` y las asocia al partner.
     *
     * @async
     * @param {Object} dataPartner - Datos del partner y opcionalmente `bankAccounts` (array).
     * @returns {Promise<Object>} Resultado con statusCode, message y data (partner creado y arrays de éxito/error) o error.
     */
    async createPartnerWithAccount(dataPartner) {
        try {
            const partner = pickFields(dataPartner, CLIENT_FIELDS);
            const response = await this.createPartner(partner);
            if (response.statusCode !== 201) {
                return { statusCode: response.statusCode, message: response.message, data: response.data };
            }
            const BankAccountError = [];
            const BankAccountSuccess = [];
            if (dataPartner.bankAccounts && dataPartner.bankAccounts.length > 0) {
                const bankAccounts = dataPartner.bankAccounts.map((account) => { return pickFields(account, BANK_ACCOUNT_PARTNER_FIELDS) })
                await Promise.all(bankAccounts.map(async (account) => {

                    if (!BankAccountSuccess.includes(account.acc_number)) {
                        account.partner_id = response.data[0];
                        const bankAccountResponse = await bankAccountService.createBankAccount(account);
                        if (bankAccountResponse.statusCode !== 201) {
                            BankAccountError.push(account.acc_number);
                        } else {
                            BankAccountSuccess.push(account.acc_number);
                        }
                    } else {
                        BankAccountSuccess.push(account.acc_number);
                    }

                }))
            }

            const partnerCreated = await this.getOnePartner(response.data[0]);
            if (partnerCreated.statusCode !== 200) {
                return { statusCode: 400, message: 'Error al crear partner con cuenta', data: { partner: partnerCreated.data, BankAccountSuccess, BankAccountError } };
            }
            return { statusCode: 201, message: 'Partner con cuenta creado con éxito',data: { partner: partnerCreated.data, BankAccountSuccess, BankAccountError }  };
        } catch (error) {
            console.log('Error en partnerService.createPartnerWithAccount:', error);
            return { statusCode: 500, message: 'Error al crear partner con cuenta', error: error.message };
        }
    },
    /**
     * Actualizar un partner y gestionar cuentas bancarias asociadas.
     *
     * - Actualiza el partner con `updatePartner`.
     * - Si se incluyen `bankAccounts`, intenta crear/actualizar las cuentas y reporta éxitos/errores.
     *
     * @async
     * @param {number|string} id - ID del partner a actualizar.
     * @param {Object} dataPartner - Datos del partner y opcionalmente `bankAccounts`.
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async updatePartnerWithAccount(id, dataPartner) {
        try {
            const partner = pickFields(dataPartner, CLIENT_FIELDS);
            const response = await this.updatePartner(id, partner);

            const BankAccountError = [];
            const BankAccountSuccess = [];

            if (dataPartner.bankAccounts && dataPartner.bankAccounts.length >= 0) {


                const bankAccounts = dataPartner.bankAccounts.map((account) => { return pickFields(account, BANK_ACCOUNT_PARTNER_FIELDS) })
                await Promise.all(bankAccounts.map(async (account) => {

                    if (!BankAccountSuccess.includes(account.acc_number)) {
                        const bankAccountResponse = await bankAccountService.createBankAccount(account);
                        if (bankAccountResponse.statusCode !== 201) {
                            BankAccountError.push(account.acc_number);
                        } else {
                            BankAccountSuccess.push(account.acc_number);
                        }
                    } else {
                        BankAccountSuccess.push(account.acc_number);
                    }

                }))
            }

            const partnerCreated = await this.getOnePartner(response.data[0]);

            if (!partnerCreated.success) {
                if (partnerCreated.error) {
                    return { statusCode: 500, message: 'Error al crear partner con cuenta', error: partnerCreated.message };
                }
                return { statusCode: 400, message: 'Error al crear partner con cuenta', data: { partner: partnerCreated.data, BankAccountSuccess, BankAccountError } };
            }
            return { statusCode: 201, message: 'Partner con cuenta creado con éxito', data: partnerCreated.data };
        } catch (error) {
            console.log('Error en partnerService.createPartnerWithAccount:', error);
            return { statusCode: 500, message: 'Error al crear partner con cuenta', error: error.message };
        }
    },
}

module.exports = partnerService;
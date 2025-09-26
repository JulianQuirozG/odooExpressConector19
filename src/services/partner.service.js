const { CLIENT_FIELDS, BANK_ACCOUNT_FIELDS, BANK_ACCOUNT_PARTNER_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const bankService = require("./bank.service");
const bankAccountService = require("./bankAccount.service");

const partnerService = {
    async getPartners(partnerFields = ['name', 'email', 'phone'], domain = []) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                fields: partnerFields,
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
    async getOnePartner(id) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                domain: [['id', '=', id]],
                fields: ['name', 'email', 'phone'],
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
    async createPartnerWithAccount(dataPartner) {
        try {
            const partner = pickFields(dataPartner, CLIENT_FIELDS);
            const response = await this.createPartner(partner);
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
            console.log(partnerCreated);
            if (partnerCreated.statusCode !== 200) {
                return { statusCode: 400, message: 'Error al crear partner con cuenta', data: { partner: partnerCreated.data, BankAccountSuccess, BankAccountError } };
            }
            return { statusCode: 201, message: 'Partner con cuenta creado con éxito',data: { partner: partnerCreated.data, BankAccountSuccess, BankAccountError }  };
        } catch (error) {
            console.log('Error en partnerService.createPartnerWithAccount:', error);
            return { statusCode: 500, message: 'Error al crear partner con cuenta', error: error.message };
        }
    },

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
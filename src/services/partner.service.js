const { CLIENT_FIELDS, BANK_ACCOUNT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const bankService = require("./bank.service");
const bankAccountService = require("./bankAccount.service");

const partnerService = {
    async getPartners(partnerFields = ['name', 'email', 'phone']) {
        try {
            const response = await odooConector.executeOdooRequest('res.partner', 'search_read', {
                fields: partnerFields
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
            const partner = pickFields(dataPartner,CLIENT_FIELDS)
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
                return { statusCode: partnerExists.statusCode, message: partnerExists.message, data: partnerExists.data};
            }
            const partner = pickFields(dataPartner, CLIENT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner', 'write', {
                ids: [Number(id)],
                vals: partner
            });
            if(!response.success) {
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
                return { statusCode: partnerExists.statusCode, message: partnerExists.message, data: partnerExists.data};
            }
            const response = await odooConector.executeOdooRequest('res.partner', 'unlink', {
                ids: [Number(id)]
            });
            if(!response.success) {
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

            if(dataPartner.bankAccounts){
                const bankAccounts = dataPartner.bankAccounts.map((account)=>{pickFields(account, BANK_ACCOUNT_FIELDS)})
                await Promise.all(bankAccounts.map(async (account) => {
                    account.partner_id = response.data; // Asignar el ID del partner recién creado
                    if(!account.bank_id){
                        const bankResponse = await bankService.getOneBank();
                    }

                }))


                for (const account of bankAccounts) {
                    account.partner_id = response.data; // Asignar el ID del partner recién creado

                    const bankAccountResponse = await bankAccountService.createBankAccount(account);
                }
            }

            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear partner con cuenta', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear partner con cuenta', data: response.data };
            }
            return { statusCode: 201, message: 'Partner con cuenta creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en partnerService.createPartnerWithAccount:', error);
            return { statusCode: 500, message: 'Error al crear partner con cuenta', error: error.message };
        }
    },
}

module.exports = partnerService;
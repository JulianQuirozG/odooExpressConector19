const { BANK_ACCOUNT_FIELDS } = require("../utils/fields");
const odooConector = require("../utils/odoo.service");
const { pickFields } = require("../utils/util");
const bankService = require("./bank.service");
/**
 * Servicio para gestionar cuentas bancarias de partners (res.partner.bank) en Odoo.
 * Proporciona métodos para listar, obtener, crear, actualizar y eliminar cuentas bancarias.
 */
const bankAccountService = {
    /**
     * Obtener cuentas bancarias.
     *
     * @async
     * @param {string[]} [bankFields=['id','display_name','partner_id','currency_id','bank_id']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (array de cuentas) o error.
     */
    async getBanksAccounts(bankFields = ['id', 'display_name', 'partner_id', 'currency_id', 'bank_id']) {
        try {
            //Obtenemos todas las cuentas bancarias
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                fields: bankFields
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener bancos', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener bancos', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Lista de bancos', data: response.data };
        } catch (error) {
            console.log('Error en bankService.getBanks:', error);
            return { statusCode: 500, message: 'Error al obtener bancos', error: error.message };
        }
    },
    /**
     * Obtener una cuenta bancaria por ID.
     *
     * @async
     * @param {number|string} id - ID de la cuenta bancaria.
     * @param {string[]} [bankFields=['id','display_name','partner_id','currency_id','bank_id']] - Campos a recuperar.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (detalle) o error.
     */
    async getOneBankAccount(id, bankFields = ['id', 'display_name', 'partner_id', 'currency_id', 'bank_id', 'acc_number']) {
        try {
            //Obtenemos la cuenta bancaria por id
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                domain: [['id', '=', id]],
                fields: bankFields,
                limit: 1
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al obtener banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al obtener banco', data: response.data };
            }

            //Si no encontramos la cuenta bancaria regresamos 404
            if (response.data.length === 0) {
                return { statusCode: 404, message: 'Banco no encontrado' };
            }

            //Regresamos la información de la consulta
            return { statusCode: 200, message: 'Detalle del banco', data: response.data[0] };
        } catch (error) {
            console.log('Error en bankService.getOneBank:', error);
            return { statusCode: 500, message: 'Error al obtener banco', error: error.message };
        }
    },
    /**
     * Crear una cuenta bancaria para un partner.
     *
     * Si `dataBank.bank_name` está presente, intenta obtener/crear el banco y asignar su ID a `bank_id`.
     *
     * @async
     * @param {Object} dataBank - Datos de la cuenta bancaria, filtrados por `BANK_ACCOUNT_FIELDS`.
     * @returns {Promise<Object>} Resultado con statusCode, message y data (id creado o respuesta) o error.
     */
    async createBankAccount(dataBank) {
        try {

            //si viene el nombre del banco se verifica si exite, en caso contgrario se crea de forma automática
            if (dataBank.bank_name) {
                let newBank = {};
                newBank = await bankService.getBanks(['id', 'name'], [['name', 'ilike', dataBank.bank_name]]);

                //Si no existe el banco lo creamos
                if (newBank.data.length === 0) {
                    newBank = await bankService.createBank({ name: dataBank.bank_name });
                    if (newBank.statusCode !== 201) {
                        return { statusCode: newBank.statusCode, message: 'No se puede crear la cuenta bancaria porque no se pudo crear el banco', error: newBank.message };
                    }
                }

                //Asignamos el id del banco a bank_id
                dataBank.bank_id = newBank.data[0].id;
            }

            //Filtramos los campos de la cuenta bancaria y la creamos
            const bank = pickFields(dataBank, BANK_ACCOUNT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'create', {
                vals_list: [bank]
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al crear banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al crear banco', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 201, message: 'Banco creado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.createBank:', error);
            return { statusCode: 500, message: 'Error al crear banco', error: error.message };
        }
    },
    /**
     * Actualizar una cuenta bancaria existente.
     *
     * @async
     * @param {number|string} id - ID de la cuenta a actualizar.
     * @param {Object} dataBank - Campos a actualizar (se filtran con BANK_ACCOUNT_FIELDS).
     * @returns {Promise<Object>} Resultado con statusCode, message y data o error.
     */
    async updateBankAccount(id, dataBank) {
        try {
            //Verificamos que la cuenta bancaria exista
            const bankExists = await this.getOneBankAccount(id);
            if (bankExists.statusCode !== 200) return { statusCode: bankExists.statusCode, message: bankExists.message, data: bankExists.data };
            
            //Filtramos los campos a actualizar y actualizamos la cuenta bancaria
            const bank = pickFields(dataBank, BANK_ACCOUNT_FIELDS);
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'write', {
                ids: [Number(id)],
                vals: bank
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al actualizar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al actualizar banco', data: response.data };
            }

            //Regresamos la información de la consulta
            return { statusCode: 201, message: 'Banco actualizado con éxito', data: response.data };
        } catch (error) {
            console.log('Error en bankService.updateBank:', error);
            return { statusCode: 500, message: 'Error al actualizar banco', error: error.message };
        }
    },
    /**
     * Eliminar una cuenta bancaria por ID.
     *
     * @async
     * @param {number|string} id - ID de la cuenta a eliminar.
     * @returns {Promise<Object>} Resultado con statusCode y message. Si hay error, incluye error o data.
     */
    async deleteBankAccount(id) {
        try {
            //Verificamos que la cuenta bancaria exista
            const bankExists = await this.getOneBankAccount(id);
            if (bankExists.statusCode !== 200) return bankExists;
            
            //Eliminamos la cuenta bancaria
            const response = await odooConector.executeOdooRequest('res.partner.bank', 'unlink', {
                ids: [Number(id)]
            });

            //Si hay algun error lo gestionamos
            if (!response.success) {
                if (response.error) {
                    return { statusCode: 500, message: 'Error al eliminar banco', error: response.message };
                }
                return { statusCode: 400, message: 'Error al eliminar banco', data: response.data };
            }

            //Regresamos la respuesta de la eliminación
            return { statusCode: 200, message: 'Banco eliminado con éxito', data: response.data };

        } catch (error) {
            console.log('Error en bankService.deleteBank:', error);
            return { statusCode: 500, message: 'Error al eliminar banco', error: error.message };
        }
    },

    /**
     * Reemplaza todas las cuentas bancarias de un partner por nuevas cuentas.
     * 
     * @async
     * @param {string} partnerExternalId - External ID del partner
     * @param {Array<Object>} bankAccounts - Array de nuevas cuentas bancarias
     * @param {string} bankAccounts[].acc_number - Número de cuenta
     * @param {number} bankAccounts[].currency_id - ID de la moneda
     * @param {string} bankAccounts[].acc_holder_name - Nombre del titular
     * @param {string} bankAccounts[].bank_name - Nombre del banco
     * @param {string} [bankAccounts[].bic] - Código BIC del banco
     * @returns {Promise<Object>} Resultado con statusCode, message y data
     * 
     * @example
     * const result = await bankAccountService.replacePartnerBankAccounts(
     *   'partner_ext_123',
     *   [
     *     {
     *       acc_number: "ES7620770024003102575766",
     *       currency_id: 1,
     *       acc_holder_name: "Prueba 2 Mueve sas",
     *       bank_name: "csaSurOccidente",
     *       bic: "BEXAESMMXXX"
     *     }
     *   ]
     * );
     */
    async replacePartnerBankAccounts(partnerExternalId, bankAccounts) {
        try {
            // Validar que se proporcionen cuentas bancarias
            if (!bankAccounts || !Array.isArray(bankAccounts) || bankAccounts.length === 0) {
                return {
                    statusCode: 400,
                    message: 'Debe proporcionar al menos una cuenta bancaria en el array bankAccounts'
                };
            }

            console.log(`Buscando partner con External ID: ${partnerExternalId}`);

            // Buscar el partner por External ID
            const partnerSearch = await odooConector.executeOdooRequest('ir.model.data', 'search_read', {
                domain: [['name', '=', partnerExternalId], ['model', '=', 'res.partner']],
                fields: ['res_id']
            });

            if (!partnerSearch.success || partnerSearch.data.length === 0) {
                return {
                    statusCode: 404,
                    message: `No se encontró partner con External ID: ${partnerExternalId}`
                };
            }

            const partnerId = partnerSearch.data[0].res_id;
            console.log(`Partner encontrado con ID: ${partnerId}`);

            // Obtener todas las cuentas bancarias existentes del partner (activas y archivadas)
            const existingBankAccounts = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                domain: ['&', ['partner_id', '=', partnerId], '|', ['active', '=', true], ['active', '=', false]],
                fields: ['id', 'acc_number', 'active'],
                context: { active_test: false } // Importante: incluir registros archivados
            });

            if (!existingBankAccounts.success) {
                return {
                    statusCode: 500,
                    message: 'Error al obtener cuentas bancarias existentes',
                    error: existingBankAccounts.message
                };
            }

            console.log(`Cuentas existentes (activas y archivadas): ${existingBankAccounts.data.length}`);

            // Archivar todas las cuentas bancarias existentes (en lugar de eliminarlas)
            if (existingBankAccounts.data.length > 0) {
                const idsToArchive = existingBankAccounts.data.map(acc => acc.id);
                console.log(`Archivando ${idsToArchive.length} cuentas bancarias existentes...`);

                const archiveResponse = await odooConector.executeOdooRequest('res.partner.bank', 'write', {
                    ids: idsToArchive,
                    vals: { active: false }
                });

                if (!archiveResponse.success) {
                    return {
                        statusCode: 500,
                        message: 'Error al archivar cuentas bancarias existentes',
                        error: archiveResponse.message
                    };
                }

                console.log('Cuentas bancarias existentes archivadas con éxito');
            } else {
                console.log('No hay cuentas bancarias existentes para archivar');
            }

            // Procesar las nuevas cuentas bancarias
            const createdAccounts = [];
            const updatedAccounts = [];
            const failedAccounts = [];

            for (const bankAccount of bankAccounts) {
                try {
                    // Preparar los datos de la cuenta bancaria
                    const accountData = {
                        partner_id: partnerId,
                        acc_number: bankAccount.acc_number,
                        currency_id: bankAccount.currency_id,
                        acc_holder_name: bankAccount.acc_holder_name || null,
                        active: true // Asegurar que la cuenta esté activa
                    };

                    // Si viene el BIC, agregarlo
                    if (bankAccount.bic) {
                        accountData.bic = bankAccount.bic;
                    }

                    // Si viene el nombre del banco, obtener/crear el banco
                    if (bankAccount.bank_name) {
                        let bank = await bankService.getBanks(['id', 'name'], [['name', 'ilike', bankAccount.bank_name]]);

                        // Si no existe el banco, crearlo
                        if (bank.data.length === 0) {
                            console.log(`Creando banco: ${bankAccount.bank_name}`);
                            bank = await bankService.createBank({ name: bankAccount.bank_name, bic: bankAccount.bic || null });
                            
                            if (bank.statusCode !== 201) {
                                failedAccounts.push({
                                    account: bankAccount,
                                    error: 'No se pudo crear el banco'
                                });
                                continue;
                            }
                            accountData.bank_id = bank.data[0];
                        } else {
                            accountData.bank_id = bank.data[0].id;
                        }
                    }

                    // Buscar si ya existe una cuenta con este número (activa o archivada)
                    const existingAccount = await odooConector.executeOdooRequest('res.partner.bank', 'search_read', {
                        domain: ['&', ['acc_number', '=', bankAccount.acc_number], '|', ['active', '=', true], ['active', '=', false]],
                        fields: ['id', 'partner_id', 'active'],
                        context: { active_test: false },
                        limit: 1
                    });

                    if (existingAccount.success && existingAccount.data.length > 0) {
                        const existingId = existingAccount.data[0].id;
                        const existingPartnerId = existingAccount.data[0].partner_id[0];

                        // Si la cuenta existe para el mismo partner, actualizarla y activarla
                        if (existingPartnerId === partnerId) {
                            console.log(`Cuenta ${bankAccount.acc_number} ya existe (ID: ${existingId}), actualizando y desarchivando...`);
                            
                            const filteredData = pickFields(accountData, BANK_ACCOUNT_FIELDS);
                            const updateResponse = await odooConector.executeOdooRequest('res.partner.bank', 'write', {
                                ids: [existingId],
                                vals: { ...filteredData, active: true }
                            });

                            if (!updateResponse.success) {
                                failedAccounts.push({
                                    account: bankAccount,
                                    error: updateResponse.message || 'Error al actualizar cuenta bancaria'
                                });
                            } else {
                                updatedAccounts.push({
                                    id: existingId,
                                    acc_number: bankAccount.acc_number,
                                    action: 'updated_unarchived'
                                });
                            }
                        } else {
                            // Si existe para otro partner, no se puede usar
                            failedAccounts.push({
                                account: bankAccount,
                                error: `La cuenta ${bankAccount.acc_number} ya existe para otro partner`
                            });
                        }
                    } else {
                        // No existe, crear una nueva
                        const filteredData = pickFields(accountData, BANK_ACCOUNT_FIELDS);
                        const createResponse = await odooConector.executeOdooRequest('res.partner.bank', 'create', {
                            vals_list: [filteredData]
                        });

                        if (!createResponse.success) {
                            failedAccounts.push({
                                account: bankAccount,
                                error: createResponse.message || 'Error al crear cuenta bancaria'
                            });
                        } else {
                            createdAccounts.push({
                                id: createResponse.data[0],
                                acc_number: bankAccount.acc_number,
                                action: 'created'
                            });
                        }
                    }

                } catch (accountError) {
                    console.error(`Error procesando cuenta bancaria ${bankAccount.acc_number}:`, accountError);
                    failedAccounts.push({
                        account: bankAccount,
                        error: accountError.message
                    });
                }
            }

            // Verificar resultados
            const totalProcessed = createdAccounts.length + updatedAccounts.length;
            if (totalProcessed === 0 && failedAccounts.length > 0) {
                return {
                    statusCode: 500,
                    message: 'No se pudo procesar ninguna cuenta bancaria',
                    data: {
                        failed: failedAccounts
                    }
                };
            }

            return {
                statusCode: 201,
                message: `Cuentas bancarias del partner actualizadas exitosamente. Archivadas: ${existingBankAccounts.data.length}, Creadas: ${createdAccounts.length}, Actualizadas: ${updatedAccounts.length}`,
                data: {
                    partnerId: partnerId,
                    archivedCount: existingBankAccounts.data.length,
                    created: createdAccounts,
                    updated: updatedAccounts,
                    failed: failedAccounts.length > 0 ? failedAccounts : undefined
                }
            };

        } catch (error) {
            console.error('Error en bankAccountService.replacePartnerBankAccounts:', error);
            return {
                statusCode: 500,
                message: 'Error al reemplazar cuentas bancarias del partner',
                error: error.message
            };
        }
    }
}

module.exports = bankAccountService;
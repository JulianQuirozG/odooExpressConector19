//Imports odoo connection
const odooConector = require("../utils/odoo.service");

//Imports services
const employeeService = require("../services/employee.service");
const moveService = require("../services/bills.service");
const bankAccountService = require("../services/bankAccount.service");
const workEntryService = require("../services/workEntry.service");

//Utils
const util_date = require("../utils/date");
const XLSX = require('xlsx');
const { payrollStruct } = require("../structs/payroll/payrrol.struct");

// Imports repositories
const paramsTypeDocumentIdentificationRepository = require("../Repository/params_type_document_identification.repository/params_type_document_identification.repository");
const paramsMunicipalitiesRepository = require("../Repository/params_municipalities/params_municipalities.repository");
const paramsPaymentMethodsRepository = require("../Repository/params_payment_methods/params_payment_methods.repository");
const { ca } = require("zod/locales");
const { excelDateToJSDate } = require("../utils/attachements.util");
const { type } = require("../schemas/product.schema");

const payrollService = {
    async getJsonPayrollById(id) {
        try {
            //Verfico que el id sea valido
            if (Number(id) <= 0 || isNaN(Number(id))) return { statusCode: 400, message: `ID de nómina '${id}' inválido, debe ser un número`, data: [] };

            //Verifico que la nómina exista
            //Obtengo la informacion de la nomina
            const payroll = await this.getpayrollById(id);
            if (payroll.statusCode !== 200) return payroll;

            const payrollJson = {};

            //Faltaria verificar si esta en algun estado la nomina "Posted"

            //----------------------------------------------- Informacion del empleado ---------------------------------------------

            //Obtengo el empleado asignado a la nomina
            const employeId = payroll.data.employee_id[0];
            const employee = await employeeService.getEmployeeById(employeId);

            let worker = {};

            //Salario del empleado
            worker.salary = employee.data.wage;

            //Direccion del empleado
            worker.address = employee.data.private_street || employee.data.private_street2 || '';

            //Nombres y apellidos del empleado
            const employeeName = employee.data.legal_name.split(' ');

            if (employeeName.length < 2) return { statusCode: 400, message: 'El nombre legal del empleado no tiene el formato esperado (minimo un nombre y apellido)', data: [] };

            //Dependiendo de la cantidad de nombres y apellidos asigno los campos
            worker.first_name = employeeName[0];
            worker.middle_name = null;
            worker.surname = null;
            worker.second_surname = null;

            if (employeeName.length == 3) {
                worker.surname = employeeName[1];
                worker.second_surname = employeeName[2];
            } else {
                worker.surname = employeeName[1];
                worker.middle_name = employeeName[2];

                worker.second_surname = employeeName[3];
            }

            //Tipo de trabajador
            const type_worker_id = Number(employee.data.x_studio_tipo_de_empleado);
            if (!type_worker_id) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El tipo de empleado no está definido', data: [] };
            worker.type_worker_id = type_worker_id;

            //Municipio
            if (!employee.data.private_city) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'La ciudad del empleado no está definida', data: [] };
            const municipality_id = (await paramsMunicipalitiesRepository.getMunicipalityByName(employee.data.private_city)).data[0].id;
            if (!municipality_id) return { statusCode: 404, message: "El municipio no está configurado en la tabla de parámetros" };
            worker.municipality_id = municipality_id;

            //Tipo de contrato
            let type_contract_id = Number(employee.data.contract_type_id[0]);
            if (!type_contract_id) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El tipo de contrato del empleado no está definido', data: [] };
            //Consulto la informacion del contrato
            const contract_info = await odooConector.executeOdooRequest("hr.contract.type", "search_read", { domain: [["id", "=", type_contract_id]] });
            if (contract_info.error) return { statusCode: 500, message: 'Error al crear partner', error: contract_info.message };
            if (!contract_info.success) return { statusCode: 400, message: 'Error al obtener la nómina', data: contract_info.data };
            if (contract_info.data.length === 0) return { statusCode: 404, message: 'Tipo de contrato no encontrado' };
            type_contract_id = Number(contract_info.data[0].x_studio_codigo_dian)
            if (type_contract_id < 1 || type_contract_id > 5) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El tipo de contrato del empleado no es válido ', data: [] };

            worker.type_contract_id = type_contract_id;

            //Pension de riesgo
            worker.high_risk_pension = false;
            //Salario integral
            worker.integral_salary = false;

            //Sub tipo de trabajador( 1. No aplica, 2. Dependiente pensionado por vejez activo)
            worker.sub_type_worker_id = 1;

            //Numero de identificacion
            const identificacion_number = Number(employee.data.identification_id);
            if (isNaN(identificacion_number)) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El número de identificación del empleado no es un número válido', data: [] };

            worker.identification_number = identificacion_number;

            //Tipo de documento de identidad
            //Busco los contactos del empleado para obtener el tipo de documento de identidad
            const contacts = await employeeService.getContactsByEmployeeId(employee.data.id);
            //let identificacion_type = contacts.data[0].l10n_latam_identification_type_id[0] || null;
            let identificacion_type = employee.data.x_studio_tipo_de_identificacion[0];
            if (!identificacion_type) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El tipo de identificación del empleado no está definido', data: [] };

            const payroll_type_document_identification_id = await paramsTypeDocumentIdentificationRepository.getTypeDocumentByCode(identificacion_type);
            if (payroll_type_document_identification_id.data.length < 1) return { statusCode: 404, message: "El tipo de documento de identificación no está configurado en la tabla de parámetros" };
            worker.payroll_type_document_identification_id = payroll_type_document_identification_id.data[0].id;

            //Codigo del trabajador
            worker_code = String(employee.data.id)

            //------------------------------------ Informacion del documento -------------------------------------
            //Tipo de documento, por defecto se asigna 9 (Nómina electrónica)
            const type_document_id = 9;

            //Consecutivo y prefix del documento, se obtiene del diario asignado al asiento contable de la nomina
            const move = (await this.getMovesByPayrollId(id)).data[0];
            const consecutive = move.sequence_number;

            //Prefix del documento
            const prefix = move.sequence_prefix.split('/')[0];

            //Periodo de la nomina
            const payroll_period_id = 5; // Por ahora el por defecto es 5 (Pago mensual)


            //-------------------------------------Pago de la nomina -------------------------------------------
            let payment = {};

            //Metodo de pago (Es el mismo metodo de pago que en las facturas)
            if (!employee.data.x_studio_metodo_de_pago) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El método de pago del empleado no está definido', data: [] };
            const payment_method = (await odooConector.executeOdooRequest("l10n_co_edi.payment.option", "search_read", { domain: [['id', '=', employee.data.x_studio_metodo_de_pago[0]]] }));
            const payment_method_id = await paramsPaymentMethodsRepository.getPaymentMethodByCode(payment_method.id);
            payment.payment_method_id = payment_method_id.id;

            //Cuenta bancaria, banco y tipo de cuenta los sacamos del contacto del empleado
            if (contacts.data[0].bank_ids.length < 1) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'El empleado no tiene cuenta bancaria asociada', data: [] };

            //Elegimos la primera cuenta bancaria del empleado
            const bankAccountId = contacts.data[0].bank_ids[0];

            //Recuperamos la informacion de la cuenta bancaria
            const bankAccount = await bankAccountService.getOneBankAccount(bankAccountId);
            if (bankAccount.statusCode !== 200) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'No se pudo recuperar la información de la cuenta bancaria del empleado', data: [] };

            if (!bankAccount.data.acc_number) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'La cuenta bancaria del empleado no tiene número de cuenta asignado', data: [] };
            if (!bankAccount.data.bank_id[1]) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'La cuenta bancaria del empleado no tiene banco asignado', data: [] };

            payment.bank_name = bankAccount.data.bank_id[1];
            payment.account_number = bankAccount.data.acc_number;
            payment.account_type = "Ahorros";



            //--------------------------------------Fecha del pago ------------------------------------------------------------
            let payment_dates = {};

            //Fecha del pago
            if (!payroll.data.paid_date) return { statusCode: 400, message: 'Error al obtener la nómina', error: `La nómina ${payroll.data.id} no tiene fecha de pago asignada`, data: [] };
            const payment_date = new Date(payroll.data.paid_date);
            payment_dates.payment_date = [payment_date]

            //-------------------------------------- periodo -------------------------------------------------------------------
            const period = {};
            //Fecha de ingreso del empleado

            //Dias trabajados

            //Fecha de reporte de liquidacion
            const issue_date = new Date();
            period.issue_date = issue_date.toISOString().split('T')[0];

            //Fechas del periodo a informar
            const today = new Date();

            // Inicio del periodo: primer día del mes actual
            const settlement_end_date = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            // Fin del periodo: último día del mes anterior
            const settlement_start_date = new Date(today.getFullYear(), today.getMonth(), 1);

            // Formatear en YYYY-MM-DD
            period.settlement_start_date = settlement_start_date.toISOString().split('T')[0];
            period.settlement_end_date = settlement_end_date.toISOString().split('T')[0];

            //-------------------------------------- Devengados -----------------------------------------------------------------

            const accrued = {};
            //Dias trabajados
            //Recuperamos la informacion de los dias trabajados
            let worked_days = 0;
            const worked_days_info = await odooConector.executeOdooRequest("hr.payslip.worked_days", "search_read", { domain: [["payslip_id", "=", payroll.data.id]] });
            if (worked_days_info.error) return { statusCode: 500, message: 'Error al crear partner', error: worked_days_info.message };
            if (!worked_days_info.success) return { statusCode: 400, message: 'Error al obtener la nómina', data: worked_days_info.data };

            //Nos recorremos los dias trabajados para obtener los dias reales trabajados
            for (const d of worked_days_info.data) {
                worked_days += d.number_of_days;
            }
            accrued.worked_days = worked_days;

            //Salario devengado
            const salary = employee.data.wage;
            accrued.accrued_salary = salary;

            //Subsidio de transporte
            const transportaion_allowance =



                //-------------------------------------- Asigno la informacion de la nomina -----------------------------------------
                payrollJson.worker = worker;
            payrollJson.type_document_id = type_document_id;
            payrollJson.prefix = prefix;
            payrollJson.worker_code = worker_code;
            payrollJson.consecutive = consecutive;
            payrollJson.payroll_period_id = payroll_period_id;
            payrollJson.payment = payment;
            payrollJson.payment_dates = payment_dates;
            payrollJson.accrued = accrued;
            payrollJson.period = period;

            return { statusCode: 200, message: 'Detalle de la nómina en formato JSON', data: payrollJson };
        } catch (error) {
            console.error('Error construyendo el JSON de la nómina:', error);
            return { statusCode: 500, success: false, error: true, message: error.message, data: [] };
        }
    },

    async getJsonPayrolls(payrolls) {
        try {
            //----------------------------------------------- Informacion del empleado ---------------------------------------------

            //Obtengo el empleado asignado a la nomina
            const employeId = payrolls[0].employee_id[0];
            const employee = await employeeService.getEmployeeById(employeId);

            let worker = {};

            //Salario del empleado
            worker.salary = employee.data.wage;

            //Direccion del empleado
            worker.address = employee.data.private_street || employee.data.private_street2 || '';

            //Nombres y apellidos del empleado
            const employeeName = employee.data.legal_name.split(' ');

            if (employeeName.length < 2) return { statusCode: 400, message: 'El nombre legal del empleado no tiene el formato esperado (minimo un nombre y apellido)', data: [] };

            //Dependiendo de la cantidad de nombres y apellidos asigno los campos
            worker.first_name = employeeName[0];
            worker.middle_name = null;
            worker.surname = null;
            worker.second_surname = null;

            if (employeeName.length == 3) {
                worker.surname = employeeName[1];
                worker.second_surname = employeeName[2];
            } else {
                worker.surname = employeeName[1];
                worker.middle_name = employeeName[2];
                worker.second_surname = employeeName[3];
            }

            //Tipo de trabajador
            const type_worker_id = Number(employee.data.x_studio_tipo_de_empleado);
            if (!type_worker_id) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El tipo de empleado del empleado ${employee.data.id} no está definido`, data: [] };
            worker.type_worker_id = type_worker_id;

            //Municipio
            if (!employee.data.private_city) return { statusCode: 400, message: 'Error al obtener la nómina', error: `La ciudad del empleado ${employee.data.id} no está definida`, data: [] };
            const municipality_id = (await paramsMunicipalitiesRepository.getMunicipalityByName(employee.data.private_city)).data[0].id;
            if (!municipality_id) return { statusCode: 404, message: `El municipio del empleado ${employee.data.id} no está configurado en la tabla de parámetros` };
            worker.municipality_id = municipality_id;

            //Tipo de contrato
            let type_contract_id = Number(employee.data.contract_type_id[0]);
            if (!type_contract_id) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El tipo de contrato del empleado ${employee.data.id} no está definido`, data: [] };

            //Consulto la informacion del contrato
            const contract_info = await odooConector.executeOdooRequest("hr.contract.type", "search_read", { domain: [["id", "=", type_contract_id]] });
            if (contract_info.error) return { statusCode: 500, message: 'Error al obtener el tipo de contrato', error: contract_info.message };
            if (!contract_info.success) return { statusCode: 400, message: 'Error al obtener la nómina', data: contract_info.data };
            if (contract_info.data.length === 0) return { statusCode: 404, message: 'Tipo de contrato no encontrado' };
            type_contract_id = Number(contract_info.data[0].x_studio_codigo_dian)
            if (type_contract_id < 1 || type_contract_id > 5) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El tipo de contrato del empleado ${employee.data.id} no es válido`, data: [] };

            worker.type_contract_id = type_contract_id;

            //Pension de riesgo
            worker.high_risk_pension = false;

            //Salario integral
            worker.integral_salarary = false;

            //Sub tipo de trabajador( 1. No aplica, 2. Dependiente pensionado por vejez activo)
            worker.sub_type_worker_id = 1;

            //Numero de identificacion
            const identificacion_number = Number(employee.data.identification_id);
            if (isNaN(identificacion_number)) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El número de identificación del empleado ${employee.data.id} no es un número válido`, data: [] };

            worker.identification_number = identificacion_number;

            //Tipo de documento de identidad
            let identificacion_type = employee.data.x_studio_tipo_de_identificacion[0];
            if (!identificacion_type) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El tipo de identificación del empleado ${employee.data.id} no está definido`, data: [] };

            const payroll_type_document_identification_id = await paramsTypeDocumentIdentificationRepository.getTypeDocumentByCode(identificacion_type);
            if (payroll_type_document_identification_id.data.length < 1) return { statusCode: 404, message: `El tipo de documento del empleado ${employee.data.id} no está configurado en la tabla de parámetros` };
            worker.payroll_type_document_identification_id = payroll_type_document_identification_id.data[0].id;

            //Codigo del trabajador
            worker_code = String(employee.data.id)



            //------------------------------------ Informacion del documento -------------------------------------
            //Tipo de documento, por defecto se asigna 9 (Nómina electrónica)
            const type_document_id = 9;

            //Consecutivo y prefix del documento, se obtiene del diario asignado al asiento contable de la nomina
            const move = await this.getMovesByPayrollId(payrolls[payrolls.length - 1].id);
            if (move.statusCode !== 200) return move;
            const consecutive = move.data[0].sequence_number;

            //Prefix del documento
            const prefix = move.data[0].sequence_prefix.split('/')[0];

            //Periodo de la nomina
            const payroll_period_id = 5; // Por ahora el por defecto es 5 (Pago mensual)


            //-------------------------------------Pago de la nomina -------------------------------------------
            let payment = {};
            const contacts = await employeeService.getContactsByEmployeeId(employee.data.id);

            //Metodo de pago (Es el mismo metodo de pago que en las facturas)
            if (!employee.data.x_studio_metodo_de_pago) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El método de pago del empleado ${employee.data.id} no está definido`, data: [] };

            const payment_method_id = employee.data.x_studio_metodo_de_pago[0];
            payment.payment_method_id = payment_method_id;

            //Cuenta bancaria, banco y tipo de cuenta los sacamos del contacto del empleado
            if (contacts.data[0].bank_ids.length < 1) return { statusCode: 400, message: 'Error al obtener la nómina', error: `El empleado ${employee.data.id} no tiene cuenta bancaria asociada`, data: [] };

            //Elegimos la primera cuenta bancaria del empleado
            const bankAccountId = contacts.data[0].bank_ids[0];

            //Recuperamos la informacion de la cuenta bancaria
            const bankAccount = await bankAccountService.getOneBankAccount(bankAccountId);
            if (bankAccount.statusCode !== 200) return { statusCode: 400, message: 'Error al obtener la nómina', error: `No se pudo recuperar la información de la cuenta bancaria del empleado ${employee.data.id}`, data: [] };

            if (!bankAccount.data.acc_number) return { statusCode: 400, message: 'Error al obtener la nómina', error: `La cuenta bancaria del empleado ${employee.data.id} no tiene número de cuenta asignado`, data: [] };
            if (!bankAccount.data.bank_id[1]) return { statusCode: 400, message: 'Error al obtener la nómina', error: `La cuenta bancaria del empleado ${employee.data.id} no tiene banco asignado`, data: [] };

            payment.bank_name = bankAccount.data.bank_id[1];
            payment.account_number = bankAccount.data.acc_number;
            payment.account_type = "Ahorros";

            //-------------------------------------- periodo -------------------------------------------------------------------
            const period = {};

            //Fechas del periodo a informar
            const today = new Date();

            //Obtengo el contrato valido hasta la fecha de fin del ultimo periodo a procesar
            const contract = await odooConector.executeOdooRequest("hr.version", "search_read", { domain: [["id", "=", Number(payrolls[0].version_id[0])]] });

            //Fecha de ingreso del empleado
            const admision_date = contract.data[contract.data.length - 1].contract_date_start;
            period.admision_date = admision_date;

            //Dias trabajados
            const startDate = new Date(admision_date);

            // Calcular la diferencia en milisegundos
            const diffTime = today - startDate;

            // Convertir a días 
            const worked_time = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // Guardar en el periodo
            period.worked_time = worked_time;
            if (period.worked_time < 0) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'La fecha de ingreso del empleado es mayor a la fecha actual', data: [] };

            //Fecha de reporte de liquidacion
            const issue_date = new Date();
            period.issue_date = issue_date.toISOString().split('T')[0];

            // Inicio del periodo: primer día del mes actual
            const settlement_end_date = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            // Fin del periodo: último día del mes anterior
            const settlement_start_date = new Date(today.getFullYear(), today.getMonth(), 1);

            // Formatear en YYYY-MM-DD
            period.settlement_start_date = settlement_start_date.toISOString().split('T')[0];
            period.settlement_end_date = settlement_end_date.toISOString().split('T')[0];

            //--------------------------------------Fecha del pago ------------------------------------------------------------
            let payment_dates = [];


            //-------------------------------------- Devengados -----------------------------------------------------------------
            const accrued = {};
            let worked_days = 0;
            let salary = 0;
            let transportation_allowance = 0;
            let accrued_total = 0;
            //bonos
            let bonuses = [];
            let total_salary_bonuses = 0;
            let total_non_salary_bonuses = 0;

            //Horas extra diurnas
            let HEDs = [];

            //Hora extra nocturnas
            let HENs = [];

            //Hora extra dominical diurna
            let HEDDFs = [];

            //Hora extra dominical nocturna
            let HENDFs = [];

            //vacaciones
            let common_vacation = [];

            //----------------------------------------Deducciones --------------------------------------------------------
            const deductions = {};
            let eps_deduction = 0;
            let pension_deduction = 0;
            let cooperativa = 0;
            let fondosp_deduction_SP = 0;
            let deductions_total = 0;
            let HEDs_total = 0;
            let HENs_total = 0;
            let HEDDFs_total = 0;
            let HENDFs_total = 0;

            deductions.eps_type_law_deductions_id = 3;
            deductions.pension_type_law_deductions_id = 5;

            //------------------------------------------------  Nominas ---------------------------------------------------------
            //Me recorro las nominas
            for (const payrollData of payrolls) {
                const id = payrollData.id;
                let common_vacation_total = 0;

                //Verfico que el id sea valido
                if (Number(id) <= 0 || isNaN(Number(id))) return { statusCode: 400, message: `ID de nómina '${id}' inválido, debe ser un número`, data: [] };

                //Asigno las fechas de pago
                if (!payrollData.paid_date) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'La nómina no tiene fecha de pago asignada', data: [] };
                const payment_date = new Date(payrollData.paid_date).toISOString().split('T')[0];
                payment_dates.push({ payment_date: payment_date });

                //Dias trabajados
                //Recuperamos la informacion de los dias trabajados
                let start_date = new Date(payrollData.date_from);
                let end_date = new Date(payrollData.date_to);

                if (end_date.getDate() >= 30) end_date.setDate(29);

                // Calcular la diferencia en milisegundos
                const diffTime = end_date - start_date;

                // Convertir a días
                const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                worked_days += days;

                // El indice de los dias empiza desde 0 
                if (util_date.esBisiesto(end_date.getFullYear()) && end_date.getMonth() == 1 && end_date.getDate() == 28) worked_days += 1;
                if (!util_date.esBisiesto(end_date.getFullYear()) && end_date.getMonth() == 1 && end_date.getDate() == 27) worked_days += 2;

                //Me recorro las lineas de la nomina para obtener los subtotales de devengados y deducciones
                let bonus = {};
                for (const line of payrollData.line_ids) {
                    //Auxilio de transporte
                    if (line.code === 'AUXT') {
                        transportation_allowance += line.total
                    }
                    //Salario basico
                    if (line.code === 'BASIC') {
                        salary += line.total
                    }
                    //Deduccion de salud
                    if (line.code === 'SEMP') {
                        eps_deduction += Math.abs(line.total)
                    }
                    //Deduccion de pension
                    if (line.code === 'PSEM') {
                        pension_deduction += Math.abs(line.total)
                    }
                    //Bono no salarial
                    if (line.code === 'BNS') {
                        bonus.non_salary_bonus = line.total;
                        total_non_salary_bonuses += line.total;
                    }
                    //Bono salarial
                    if (line.code === 'BS') {
                        total_salary_bonuses += line.total;
                        bonus.salary_bonus = line.total;
                    }
                    //Horas extra diurnas
                    if (line.code === 'HED') {
                        HEDs_total += line.total;
                    }
                    //Horas extra nocturnas
                    if (line.code === 'HEN') {
                        HENs_total += line.total;
                    }
                    //Horas extra diurnas dominicales
                    if (line.code === 'HEDD') {
                        HEDDFs_total += line.total;
                    }
                    //Horas extra nocturnas dominicales
                    if (line.code === 'HEDN') {
                        HENDFs_total += line.total;
                    }
                    //Vacaciones comunes
                    if (line.code === 'VCS') {
                        common_vacation_total += line.total;
                    }

                }


                //Me recorro las entrdas de trabajo para obtener las vacaciones
                const work_entry = await workEntryService.getWorkEntries([["date", ">=", payrollData.date_from], ["date", "<=", payrollData.date_to], ["employee_id", "=", employee.data.id]]);
                let holiday_start = null;
                let holiday_end = null;


                //Obtengo los dias totales de vacaciones
                const days_worked = (payrollData.worked_days_ids.filter(day => day.work_entry_type_id[1] == "Vacaciones"));
                const holiday_days = days_worked.length > 0 ? days_worked[0].number_of_days : 0;

                for (const entry of work_entry.data) {
                    //vacaciones
                    if (entry.work_entry_type_id[1] == "Vacaciones" || new Date(entry.date).getDay() == 6) {
                        //Reduzco los dias trabajados
                        worked_days--;

                        //Asigno las fechas de inicio y fin de las vacaciones
                        if (!holiday_start) holiday_start = new Date(entry.date);
                        holiday_end = new Date(entry.date);
                    } else {
                        //Calculo las vacaciones
                        if (holiday_start && holiday_end) {
                            const quantity = ((holiday_end - holiday_start) / (1000 * 60 * 60 * 24)) + 1;
                            const payment = (common_vacation_total / holiday_days) * quantity;

                            common_vacation.push({
                                start_date: holiday_start,
                                end_date: holiday_end,
                                quantity: quantity,
                                payment: payment
                            });
                        }
                        holiday_start = null;
                        holiday_end = null;
                    }
                }

                // Calculo las vacaciones
                if (holiday_start && holiday_end) {
                    common_vacation.push({
                        start_date: holiday_start,
                        end_date: holiday_end,
                        quantity: ((holiday_end - holiday_start) / (1000 * 60 * 60 * 24)) + 1
                    });
                }


                //Me recorro los dias trabajados para obtener las horas extra diurnas y nocturnas, dominicales diurnas y nocturnas
                for (const worked_day of payrollData.worked_days_ids) {
                    //Horas extra diurnas
                    if (worked_day.work_entry_type_id[1] == "Hora Extra Diurna") {

                        //Calculo el valor de las horas diurnas
                        let worked_hours = worked_day.number_of_hours;
                        let paid_of_hours = HEDs_total / worked_hours;

                        //Me recorro las entradas de trabajo para obtener el tipo de hora extra
                        for (const entry of work_entry.data) {

                            //Hora extra diurna
                            if (entry.work_entry_type_id[1] == "Hora Extra Diurna") {
                                // Crear fecha de inicio basada en la fecha de entrada
                                // Asumimos que las horas extras empiezan después de la jornada normal (6:00 AM)
                                const baseDate = new Date(entry.date + 'T01:00:00');

                                // Calcular fecha de fin sumando las horas trabajadas (duration está en horas)
                                const endTime = new Date(baseDate.getTime() + (entry.duration * 60 * 60 * 1000));

                                HEDs.push({
                                    start_time: baseDate.toISOString(),
                                    end_time: endTime.toISOString(),
                                    quantity: entry.duration,
                                    payment: paid_of_hours * entry.duration,
                                    percentage: ((paid_of_hours * entry.duration) / salary) * 100
                                });
                            }
                        }
                    }

                    //Horas extra nocturnas
                    if (worked_day.work_entry_type_id[1] == "Hora Extra Nocturna") {
                        //Calculo el valor de las horas nocturnas
                        let worked_hours = worked_day.number_of_hours;
                        let paid_of_hours = HENs_total / worked_hours;

                        //Me recorro las entradas de trabajo para obtener el tipo de hora extra
                        for (const entry of work_entry.data) {

                            //Hora extra nocturna
                            if (entry.work_entry_type_id[1] == "Hora Extra Nocturna") {
                                // Crear fecha de inicio basada en la fecha de entrada
                                // Asumimos que las horas extras empiezan después de la jornada normal (9:00 PM)
                                const baseDate = new Date(entry.date + 'T16:00:00');

                                // Calcular fecha de fin sumando las horas trabajadas (duration está en horas)
                                const endTime = new Date(baseDate.getTime() + (entry.duration * 60 * 60 * 1000));

                                HENs.push({
                                    start_time: baseDate.toISOString(),
                                    end_time: endTime.toISOString(),
                                    quantity: entry.duration,
                                    payment: paid_of_hours * entry.duration,
                                    percentage: ((paid_of_hours * entry.duration) / salary) * 100
                                });
                            }
                        }
                    }

                    //Horas extra diurnas dominicales
                    if (worked_day.work_entry_type_id[1] == "Hora Extra Dominical Diurna") {

                        //Calculo el valor de las horas diurnas
                        let worked_hours = worked_day.number_of_hours;
                        let paid_of_hours = HEDDFs_total / worked_hours;

                        //Me recorro las entradas de trabajo para obtener el tipo de hora extra
                        for (const entry of work_entry.data) {

                            //Hora extra diurna
                            if (entry.work_entry_type_id[1] == "Hora Extra Dominical Diurna") {
                                // Crear fecha de inicio basada en la fecha de entrada
                                // Asumimos que las horas extras empiezan después de la jornada normal (6:00 AM)
                                const baseDate = new Date(entry.date + 'T01:00:00');

                                // Calcular fecha de fin sumando las horas trabajadas (duration está en horas)
                                const endTime = new Date(baseDate.getTime() + (entry.duration * 60 * 60 * 1000));

                                HEDDFs.push({
                                    start_time: baseDate.toISOString(),
                                    end_time: endTime.toISOString(),
                                    quantity: entry.duration,
                                    payment: paid_of_hours * entry.duration,
                                    percentage: ((paid_of_hours * entry.duration) / salary) * 100
                                });
                            }
                        }
                    }

                    //Horas extra nocturnas dominicales
                    if (worked_day.work_entry_type_id[1] == "Hora Extra Dominical Nocturna") {
                        //Calculo el valor de las horas nocturnas
                        let worked_hours = worked_day.number_of_hours;
                        let paid_of_hours = HENDFs_total / worked_hours;

                        //Me recorro las entradas de trabajo para obtener el tipo de hora extra
                        for (const entry of work_entry.data) {

                            //Hora extra nocturna
                            if (entry.work_entry_type_id[1] == "Hora Extra Dominical Nocturna") {
                                // Crear fecha de inicio basada en la fecha de entrada
                                // Asumimos que las horas extras empiezan después de la jornada normal (9:00 PM)
                                const baseDate = new Date(entry.date + 'T21:00:00');

                                // Calcular fecha de fin sumando las horas trabajadas (duration está en horas)
                                const endTime = new Date(baseDate.getTime() + (entry.duration * 60 * 60 * 1000));

                                HENDFs.push({
                                    start_time: baseDate.toISOString(),
                                    end_time: endTime.toISOString(),
                                    quantity: entry.duration,
                                    payment: paid_of_hours * entry.duration,
                                    percentage: ((paid_of_hours * entry.duration) / salary) * 100
                                });
                            }
                        }
                    }

                }

                if (bonus.salary_bonus || bonus.non_salary_bonus) bonuses.push(bonus);


            }

            //Devengados
            accrued.worked_days = worked_days;
            accrued.salary = salary;
            accrued.transportation_allowance = transportation_allowance;
            if (bonuses.length > 0) accrued.bonuses = bonuses;
            if (HENs.length > 0) accrued.HENs = HENs;
            if (HEDs.length > 0) accrued.HEDs = HEDs;
            if (common_vacation.length > 0) accrued.common_vacation = common_vacation;
            if (HEDDFs.length > 0) accrued.HEDDFs = HEDDFs;
            if (HENDFs.length > 0) accrued.HENDFs = HENDFs;

            //Total devengados
            accrued_total = salary + transportation_allowance + HEDs_total + HENs_total + HEDDFs_total + HENDFs_total + total_salary_bonuses + total_non_salary_bonuses;
            accrued.accrued_total = accrued_total;

            //Deducciones
            deductions.eps_deduction = eps_deduction;
            deductions.pension_deduction = pension_deduction;
            deductions.cooperativa = cooperativa;
            deductions.fondosp_deduction_SP = fondosp_deduction_SP;


            //Total deducciones
            deductions_total = eps_deduction + pension_deduction + cooperativa + fondosp_deduction_SP;
            deductions.deductions_total = deductions_total;


            //-------------------------------------- Asigno la informacion de la nomina -----------------------------------------
            const payrollJson = {};
            payrollJson.worker = worker;
            payrollJson.type_document_id = type_document_id;
            payrollJson.prefix = prefix;
            payrollJson.worker_code = worker_code;
            payrollJson.consecutive = consecutive;
            payrollJson.payroll_period_id = payroll_period_id;
            payrollJson.payment = payment;
            payrollJson.payment_dates = payment_dates;
            payrollJson.accrued = accrued;
            payrollJson.period = period;
            payrollJson.deductions = deductions;
            return { statusCode: 200, message: 'Detalle de la nómina en formato JSON', data: payrollJson };
        } catch (error) {
            console.error('Error construyendo el JSON de la nómina:', error);
            return { statusCode: 500, success: false, error: true, message: error.message, data: [] };
        }
    },

    async getpayrollById(id) {
        try {
            //Verfico que el id sea valido
            if (Number(id) <= 0 || isNaN(Number(id))) return { statusCode: 400, message: `ID de nómina '${id}' inválido, debe ser un número`, data: [] };

            //Recupero la informacion de la nómina
            const payroll = await odooConector.executeOdooRequest("hr.payslip", "search_read", { domain: [["id", "=", id]], limit: 1 });
            if (payroll.error) return { statusCode: 500, message: 'Error al crear partner', error: payroll.message };
            if (!payroll.success) return { statusCode: 400, message: 'Error al obtener la nómina', data: payroll.data };
            if (payroll.data.length === 0) return { statusCode: 404, message: 'Nómina no encontrada' };

            //Regreso la informacion de la nomina
            return { statusCode: 200, message: 'Detalle de la nómina', data: payroll.data[0] };
        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },

    async getPayrollsByDates(startDate, endDate) {
        try {
            //Verifico que las fechas sean validas
            if (!startDate || !endDate) return { statusCode: 400, message: 'Fechas de inicio y fin son requeridas', data: [] };
            startDate = (new Date(startDate)).toISOString().slice(0, 10);
            endDate = (new Date(endDate)).toISOString().slice(0, 10);

            //Verifico que la fecha de inicio sea menor o igual a la fecha de fin
            if (new Date(startDate) > new Date(endDate)) return { statusCode: 400, message: 'La fecha de inicio debe ser menor o igual a la fecha de fin', data: [] };

            //Recupero la informacion de la nómina
            const payroll = await odooConector.executeOdooRequest("hr.payslip", "search_read", { domain: [["date_from", ">=", startDate], ["date_to", "<=", endDate]] });
            if (payroll.error) return { statusCode: 500, message: 'Error al crear partner', error: payroll.message };
            if (!payroll.success) return { statusCode: 400, message: 'Error al obtener la nómina', data: payroll.data };

            //Me recorro las nominas y les agrego las lineas de la nomina y los dias
            payroll.data = await Promise.all(payroll.data.map(async (payslip) => {
                //Recupero las lineas de la nomina
                const lines = await odooConector.executeOdooRequest("hr.payslip.line", "search_read", { domain: [["slip_id", "=", payslip.id]] });
                if (lines.error) return { statusCode: 500, message: 'Error al obtener las líneas de la nómina', error: lines.message };
                if (!lines.success) return { statusCode: 400, message: 'Error al obtener las líneas de la nómina', data: lines.data };
                payslip.line_ids = lines.data;

                //Recupero los dias trabajados de la nomina
                const worked_days = await odooConector.executeOdooRequest("hr.payslip.worked_days", "search_read", { domain: [["payslip_id", "=", payslip.id]] });
                if (worked_days.error) return { statusCode: 500, message: 'Error al obtener los días trabajados de la nómina', error: worked_days.message };
                if (!worked_days.success) return { statusCode: 400, message: 'Error al obtener los días trabajados de la nómina', data: worked_days.data };
                payslip.worked_days_ids = worked_days.data;

                return payslip;
            }));
            //Regreso la informacion de la nomina
            return { statusCode: 200, message: `Detalles de las nominas entre ${startDate} y ${endDate}`, data: payroll.data };
        } catch (error) {
            console.error('Error al recuperar nomina', error);
            return { statusCode: 500, success: false, error: true, message: 'Error interno del servidor' };
        }
    },

    async getMovesByPayrollId(payrollId) {
        try {
            //Verfico que el id sea valido
            if (Number(payrollId) <= 0 || isNaN(Number(payrollId))) return { statusCode: 400, message: `ID de nómina '${payrollId}' inválido, debe ser un número`, data: [] };

            //Verifico que la nomina exista
            const payroll = await this.getpayrollById(payrollId);
            if (payroll.statusCode !== 200) return payroll;

            //Recupero los asientos contables de la nomina
            const response = await odooConector.executeOdooRequest("hr.payslip", "action_open_move", { ids: [Number(payrollId)] });
            if (response.error) return { statusCode: 500, message: 'Error al obtener los asientos contables de la nómina', error: response.message };
            if (!response.success) return { statusCode: 400, message: 'Error al obtener los asientos contables de la nómina', data: response.data };

            if ((response.data.res_id == 0 || response.data.res_id == false) && (!response.data.domain || response.data.domain.length == 0)) return { statusCode: 404, message: `No se encontraron asientos contables para la nómina ${payrollId}`, data: [] };

            //Obtengo los ids de los asientos contables
            let moves = response.data.res_id == 0 ? response.data.domain[0][2] : [response.data.res_id];

            //Recupero la informacion de los asientos contables
            moves = await Promise.all(moves.map(async (moveId) => {
                const move = await moveService.getOneBill(moveId);
                return move.data;
            }));

            //Regreso la informacion de los asientos contables de la nomina
            return { statusCode: 200, message: 'Asientos contables de la nómina', data: moves };

        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },


    async reportPayrollsByDates(startDate = '2025/10/01', endDate = '2025/10/31') {
        try {
            //Obtengo las nominas entre las fechas
            const payrolls = await this.getPayrollsByDates(startDate, endDate);
            if (payrolls.statusCode !== 200) return payrolls;

            //Agrupo las nominas por empleado
            let payrollsByEmployee = new Map();
            payrolls.data.forEach(payroll => {
                if (!payrollsByEmployee.has(payroll.employee_id[0])) {
                    payrollsByEmployee.set(payroll.employee_id[0], []);
                }

                payrollsByEmployee.get(payroll.employee_id[0]).push(payroll);
            });

            const payrollsJson = []
            //Obtengo los json de las nominas
            for (let [employeeId, employeePayrolls] of payrollsByEmployee) {
                const payroll = await this.getJsonPayrolls(employeePayrolls);
                if (payroll.statusCode == 200) payrollsJson.push(payroll);
                else payrollsJson.push({ message: payroll.message, data: payroll.error });

            }
            return { statusCode: 200, message: `Nóminas reportadas entre ${startDate} y ${endDate}`, data: payrollsJson };
        } catch (error) {
            console.error('Error al reportar nómina', error);
            return { statusCode: 500, success: false, error: true, message: 'Error interno del servidor' };
        }
    },

    async reportPayrollsByExcel(file) {
        try {
            if (!file) return { statusCode: 400, message: 'Archivo Excel es requerido', data: [] };
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });

            //obtengo la hoja Nomina
            const sheetName = workbook.SheetNames[2];

            if (!sheetName) return { statusCode: 400, message: `Hoja Nomina no encontrada`, data: [] };
            const ws = workbook.Sheets[sheetName];

            // Procesar cada hoja del libro

            //defino el rango de la A a la BN
            const ref = XLSX.utils.decode_range(ws['!ref']);
            // {s:{r,c}, e:{r,c}}
            const start = { r: 7, c: 0 };   //r:(row inicial del archivo),c (A = col 0 del archivo)
            const end = { r: ref.e.r, c: 83 };     // r = ultima row activa, CB = (col 79 (0-based) del archivo)
            const rangeStr = XLSX.utils.encode_range(start, end);

            //obtengo las claves del objeto de la estructura de la nomina para usarlas como nombre de las columnas
            const KEYS = Object.keys(payrollStruct);

            // Obtiene matriz de filas (arrays), dentro del rango definido
            const rows = XLSX.utils.sheet_to_json(ws, {
                header: KEYS,
                range: rangeStr,
                raw: true,
                blankrows: true, // ya omite filas 100% vacías
                defval: null,      // rellena celdas vacías con 0
            });


            const startPeriod = { r: 1, c: 13 };   //r:(row inicial del archivo),c (A = col 0 del archivo)
            const endPeriod = { r: 4, c: 13 };     // r = ultima row activa, AU = (col 46 (0-based) del archivo)
            const rangeStrPeriod = XLSX.utils.encode_range(startPeriod, endPeriod);

            //obtengo los datos del periodo que se encuentran en el encabezado (1, 13) - (4, 13)
            const periodData = XLSX.utils.sheet_to_json(ws, {
                header: 1,
                range: rangeStrPeriod,
                defval: 0,      // rellena celdas vacías con 0
            });

            const period = {
                issue_date: excelDateToJSDate(periodData[0][0]),
                settlement_start_date: excelDateToJSDate(periodData[1][0]),
                settlement_end_date: excelDateToJSDate(periodData[2][0]),
            }

            const response = [];
            for (const row of rows) {
                if (!row.numero || row.numero == 0 || row.numero == "TOTALES") continue; //si no tiene numero de identificacion, no proceso la fila
                const worker = {
                    salary: Number(row.sueldo_contrato),
                    address: row.direccion ? row.direccion : '',
                    first_name: row.primer_nombre ? row.primer_nombre : '',
                    middle_name: row.segundo_nombre ? row.segundo_nombre : '',
                    surname: row.primer_apellido ? row.primer_apellido : '',
                    second_surname: row.segundo_apellido ? row.segundo_apellido : null,
                    type_worker_id: row.tipo_empleado ? Number(row.tipo_empleado) : null,
                    municipality_id: row.municipio ? Number(row.municipio) : null,
                    type_contract_id: row.tipo_contrato ? Number(row.tipo_contrato) : null,
                    high_risk_pension: row.pensionado == 'Si' ? true : false,
                    integral_salarary: row.tipo_salario == 'Integral' ? true : false,
                    sub_type_worker_id: row.subtipo_empleado ? Number(row.subtipo_empleado) : null,
                    identification_number: row.cedula ? row.cedula : '',
                    payroll_type_document_identification_id: row.tipo_documento ? Number(row.tipo_documento) : null,
                }

                const payment = {
                    payment_method_id: Number(row.metodo_pago) ? Number(row.metodo_pago) : null,
                    bank_name: row.banco,
                    account_number: String(row.numero_cuenta),
                    account_type: row.tipo_cuenta
                }

                const accrued = {
                    worked_days: Number(row.dias) ? Number(row.dias) : 0,
                    salary: Number(row.sueldo_contrato) ? Number(row.sueldo_contrato) : 0,
                    transportation_allowance: Number(row.auxilio_transporte) ? Number(row.auxilio_transporte) : 0,
                    accrued_total: Number(row.total_devengado) ? Number(row.total_devengado) : 0,
                }

                //Bonos salariales y no salariales
                const devengados_salariales = Number(row.otros_devengos_no_salariales);
                const devengados_no_salariales = Number(row.otros_devengos_salariales);
                if (row.otros_devengos_no_salariales && !isNaN(devengados_salariales) || row.otros_devengos_salariales && !isNaN(devengados_no_salariales)) {
                    accrued.bonuses = [];

                    row.otros_devengos_no_salariales ? accrued.bonuses.push({
                        non_salary_bonus: devengados_salariales
                    }) : null;
                    row.otros_devengos_salariales ? accrued.bonuses.push({
                        salary_bonus: devengados_no_salariales
                    }) : null;
                }

                //Vacaciones disfrutadas
                if (row.vacaciones_dias && row.vacaciones_dias) {
                    const vacation_days = Number(String(row.vacaciones_dias));
                    const vacation_payment = Number(String(row.vacaciones_disfrutadas));
                    const start_date = new Date(excelDateToJSDate(row.vacaciones_salida));
                    const end_date = new Date(excelDateToJSDate(row.vacaciones_ingreso));

                    //Si hay dias de vacaciones disfrutadas
                    if (vacation_days != 0 && !isNaN(vacation_days)) {
                        accrued.common_vacation = [];
                        //Verificamos si existen los campos en el excel
                        //Dias de vacaciones disfrutadas mayores a 0
                        if (vacation_days <= 0) {
                            response.push({ error: `Error en los dias de vacaciones disfrutadas para el empleado ${worker.first_name} ${worker.surname}, valor debe ser mayor a 0` });
                            continue;
                        }

                        // Pago de vacaciones disfrutadas mayor a 0
                        if (!vacation_payment || isNaN(vacation_payment) || vacation_payment <= 0) {
                            response.push({ error: `Error en el pago de vacaciones disfrutadas para el empleado ${worker.first_name} ${worker.surname}, valor de pago no definido o invalido` });
                            continue;
                        }

                        // Fechas de vacaciones disfrutadas validas
                        if (!start_date || !end_date || !row.vacaciones_ingreso || !row.vacaciones_salida) {
                            response.push({ error: `Error en las fechas de vacaciones disfrutadas para el empleado ${worker.first_name} ${worker.surname}, fechas no definidas o invalidas` });
                            continue;
                        }

                        // Fecha de inicio menor a fecha de fin
                        if (start_date > end_date) {
                            response.push({ error: `Error en las fechas de vacaciones disfrutadas para el empleado ${worker.first_name} ${worker.surname}, la fecha de inicio es mayor a la fecha de fin` });
                            continue;
                        }

                        // Agrego las vacaciones disfrutadas al objeto de devengados
                        accrued.common_vacation.push({
                            quantity: vacation_days,
                            payment: vacation_payment,
                            start_date: start_date.toISOString().split('T')[0],
                            end_date: end_date.toISOString().split('T')[0]
                        });
                    }
                }

                //Incapacidades
                if (row.ieg) {
                    //Prepraro la informacion de la incapacidad
                    const disability_days = Number(String(row.ieg));
                    const disability_payment = Number(String(row.incapacidad_general));
                    const type_disability = Number(String(row.incapacidad_tipo));
                    const start_date = new Date(excelDateToJSDate(row.incapacidad_fecha_inicial));
                    const end_date = new Date(excelDateToJSDate(row.incapacidad_fecha_final));

                    //Verifico que los dias de incapacidad sean validos
                    if (isNaN(disability_days) || disability_days <= 0) {
                        response.push({ error: `Error en los dias de incapacidad general para el empleado ${worker.first_name} ${worker.surname}, valor debe ser mayor a 0` });
                        continue;
                    }

                    //Verifico que el pago de incapacidad sea valido
                    if (isNaN(disability_payment) || disability_payment <= 0) {
                        response.push({ error: `Error en el pago de incapacidad general para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Verifico que las fechas de incapacidad sean validas
                    if (!start_date || !end_date || !row.incapacidad_fecha_inicial || !row.incapacidad_fecha_final) {
                        response.push({ error: `Error en las fechas de incapacidad general para el empleado ${worker.first_name} ${worker.surname}, fechas no definidas o invalidas` });
                        continue;
                    }

                    //Verifico que el tipo de incapacidad sea valido (1 a 3)
                    if (isNaN(type_disability) || type_disability > 4 && type_disability < 0) {
                        response.push({ error: `Error en el tipo de incapacidad para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Verificar que la diferencia entre las fechas sea igual a los dias de incapacidad
                    const diffTime = Math.abs(end_date - start_date);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays !== disability_days) {
                        response.push({ error: `Error en los dias de incapacidad general para el empleado ${worker.first_name} ${worker.surname}, la diferencia entre las fechas no coincide con los dias de incapacidad` });
                        continue;
                    }

                    //Agrego las incapacidades al objeto de devengados
                    accrued.work_disabilities = [];
                    accrued.work_disabilities.push({
                        quantity: disability_days,
                        payment: disability_payment,
                        type: type_disability,
                        start_date: start_date.toISOString().split('T')[0],
                        end_date: end_date.toISOString().split('T')[0]
                    });
                }

                //Cesantias
                if (row.cesantia && row.intereses_cesantias) {
                    const payment = Number(String(row.cesantia));
                    const interest_payment = Number(String(row.intereses_cesantias));

                    //Verifico que el pago de cesantias sea valido
                    if (isNaN(payment) || payment <= 0) {
                        response.push({ error: `Error en el pago de cesantias para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Verifico que el pago de intereses de cesantias sea valido
                    if (isNaN(interest_payment) || interest_payment <= 0) {
                        response.push({ error: `Error en el pago de intereses de cesantias para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Agrego las cesantias al objeto de devengados
                    accrued.severance =  [   {
                        payment: payment,
                        interest_payment: interest_payment,
                        percentage: "12"
                    }];
                }

                //Licencias de maternidad
                if (row.lm) {
                    //Prepraro la informacion de la licencia de maternidad
                    const maternity_days = Number(row.lm);
                    const maternity_payment = Number(row.licencia_maternidad);
                    const start_date = new Date(excelDateToJSDate(row.licencia_maternidad_fecha_inicial));
                    const end_date = new Date(excelDateToJSDate(row.licencia_maternidad_fecha_final));

                    //Verifico que los dias de licencia de maternidad sean validos
                    if (isNaN(maternity_days) || maternity_days <= 0) {
                        response.push({ error: `Error en los dias de licencia de maternidad para el empleado ${worker.first_name} ${worker.surname}, valor debe ser mayor a 0` });
                        continue;
                    }

                    //Verifico que el pago de licencia de maternidad sea valido
                    if (isNaN(maternity_payment) || maternity_payment <= 0) {
                        response.push({ error: `Error en el pago de licencia de maternidad para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Verifico que las fechas de licencia de maternidad sean validas
                    if (!start_date || !end_date || !row.licencia_maternidad_fecha_inicial || !row.licencia_maternidad_fecha_final) {
                        response.push({ error: `Error en las fechas de licencia de maternidad para el empleado ${worker.first_name} ${worker.surname}, fechas no definidas o invalidas` });
                        continue;
                    }

                    //Verificar que la diferencia entre las fechas sea igual a los dias de licencia de maternidad
                    const diffTime = Math.abs(end_date - start_date);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays !== maternity_days) {
                        response.push({ error: `Error en los dias de licencia de maternidad para el empleado ${worker.first_name} ${worker.surname}, la diferencia entre las fechas no coincide con los dias de licencia de maternidad` });
                        continue;
                    }

                    //Agrego las licencias de maternidad al objeto de devengados
                    accrued.maternity_leave = [];
                    accrued.maternity_leave.push({
                        quantity: maternity_days,
                        payment: maternity_payment,
                        start_date: start_date.toISOString().split('T')[0],
                        end_date: end_date.toISOString().split('T')[0]
                    });
                }

                //Licencias de paternidad
                if (row.lp) {
                    //Prepraro la informacion de la licencia de paternidad
                    const paternity_days = Number(row.lp);
                    const paternity_payment = Number(row.licencia_paternidad);
                    const start_date = new Date(excelDateToJSDate(row.licencia_paternidad_fecha_inicial));
                    const end_date = new Date(excelDateToJSDate(row.licencia_paternidad_fecha_final));

                    //Verifico que los dias de licencia de paternidad sean validos
                    if (isNaN(paternity_days) || paternity_days <= 0) {
                        response.push({ error: `Error en los dias de licencia de paternidad para el empleado ${worker.first_name} ${worker.surname}, valor debe ser mayor a 0` });
                        continue;
                    }

                    //Verifico que el pago de licencia de paternidad sea valido
                    if (isNaN(paternity_payment) || paternity_payment <= 0) {
                        response.push({ error: `Error en el pago de licencia de paternidad para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Verifico que las fechas de licencia de paternidad sean validas
                    if (!start_date || !end_date || !row.licencia_paternidad_fecha_inicial || !row.licencia_paternidad_fecha_final) {
                        response.push({ error: `Error en las fechas de licencia de paternidad para el empleado ${worker.first_name} ${worker.surname}, fechas no definidas o invalidas` });
                        continue;
                    }

                    //Verificar que la diferencia entre las fechas sea igual a los dias de licencia de paternidad
                    const diffTime = Math.abs(end_date - start_date);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays !== paternity_days) {
                        response.push({ error: `Error en los dias de licencia de paternidad para el empleado ${worker.first_name} ${worker.surname}, la diferencia entre las fechas no coincide con los dias de licencia de paternidad` });
                        continue;
                    }

                    //Agrego las licencias de paternidad al objeto de devengados
                    if (!accrued.maternity_leave) accrued.maternity_leave = []

                    accrued.maternity_leave.push({
                        quantity: paternity_days,
                        payment: paternity_payment,
                        start_date: start_date.toISOString().split('T')[0],
                        end_date: end_date.toISOString().split('T')[0]
                    });
                }

                const deductions = {
                    eps_type_law_deductions_id: 3,
                    pension_type_law_deductions_id: 5,
                    eps_deduction: Number(row.aportes_salud),
                    pension_deduction: Number(row.aportes_pension),
                    //cooperativa: 0,
                    //fondosp_deduction_SP: 0,
                    deductions_total: Number(row.total_deducciones)
                }

                //Dotaciones
                if (row.dotacion) {

                    //Verifico que el pago de dotacion sea valido
                    const dotation_payment = Number(row.dotacion);
                    if (isNaN(dotation_payment) || dotation_payment <= 0) {
                        response.push({ error: `Error en el pago de dotacion para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                        continue;
                    }

                    //Agrego la dotacion al objeto de devengados
                    accrued.endowment = String(row.dotacion);
                }

                const payment_dates = []
                if (!row.fecha_pago1 && !row.fecha_pago2) {
                    response.push({ error: `Error en las fechas de pago para el empleado ${worker.first_name} ${worker.surname}, al menos una fecha de pago debe estar definida` });
                    continue;
                }

                if (row.fecha_pago1 && row.fecha_pago1 !== '') payment_dates.push({ payment_date: excelDateToJSDate(row.fecha_pago1) });
                if (row.fecha_pago2 && row.fecha_pago2 !== '') payment_dates.push({ payment_date: excelDateToJSDate(row.fecha_pago2) });


                period.worked_time = row.Dias_en_la_empresa ? Number(row.Dias_en_la_empresa) : null;
                period.admision_date = excelDateToJSDate(row.fecha_ingreso);

                const payroll = {
                    notes: "Nómina reportada desde archivo Excel",
                    period: period,
                    prefix: "NI",
                    worker: worker,
                    accrued: accrued,
                    payment: payment,
                    deductions: deductions,
                    consecutive: row.numero ? Number(row.numero) : null,
                    worker_code: row.cedula ? String(row.cedula) : null,
                    sendmailtome: false,
                    payment_dates: payment_dates,
                    type_document_id: 9,
                    payroll_period_id: periodData[3][0] ? Number(periodData[3][0]) : null,
                }

                //mapeo los dias ocupados en el periodo del mes
                let mes = [];
                this.arregloDiasOcupados(mes, new Date(excelDateToJSDate(period.settlement_start_date)));

                //Saco el Json para las Horas Extra Diurna
                const HEDs = this.extraTimeHours([{ type: 'HED', quantity: row.hed, payment: row.horas_extras_diurnas_125 }], 'HEDs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HEDs.data?.length > 0) {
                    payroll.accrued.HEDs = HEDs.data;
                }

                //Saco el json para las Horas Extra Nocturna
                const HENs = this.extraTimeHours([{ type: 'HEN', quantity: row.hen, payment: row.horas_extras_nocturnas_175 }], 'HENs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HENs.data?.length > 0) {
                    payroll.accrued.HENs = HENs.data;
                }

                //Saco el json para los recargos nocturnos dominicales
                const HRNs = this.extraTimeHours([{ type: 'HRN', quantity: row.rn, payment: row.recargo_nocturno_35 }], 'HRNs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HRNs.data?.length > 0) {
                    payroll.accrued.HRNs = HRNs.data;
                }

                //Saco el json para las horas extra dominicales diurnos
                const HEDDFs = this.extraTimeHours([{ type: 'HEDDF', quantity: row.hedd, payment: row.horas_extras_diurna_dominical_205 }], 'HEDDFs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HEDDFs.data?.length > 0) {
                    payroll.accrued.HEDDFs = HEDDFs.data;
                }

                //Saco el json para los recargos dominicales diurnos
                const HRDDFs = this.extraTimeHours([{ type: 'HRDDF', quantity: row.rd, payment: row.recargo_dominical_festivo_180 }], 'HRDDFs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HRDDFs.data?.length > 0) {
                    payroll.accrued.HRDDFs = HRDDFs.data;
                }

                //Saco el json para los horas extra dominicales nocturnos
                const HENDFs = this.extraTimeHours([{ type: 'HENDF', quantity: row.hedn, payment: row.horas_extras_nocturna_dominical_255 }], 'HENDFs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HENDFs.data?.length > 0) {
                    payroll.accrued.HENDFs = HENDFs.data;
                }

                //Saco el json para los recargos dominicales nocturnos
                const HRNDFs = this.extraTimeHours([{ type: 'HRNDF', quantity: row.rdn, payment: row.recargo_dominical_festivo_nocturno_215 }], 'HRNDFs', period.settlement_start_date, period.settlement_end_date, mes);
                if (HRNDFs.data?.length > 0) {
                    payroll.accrued.HRNDFs = HRNDFs.data;
                }

                response.push(payroll)
            }



            return { statusCode: 200, message: `Nóminas reportadas desde archivo Excel`, data: response };

        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },


    /**
     * Construye las jornadas de horas extra dentro de un periodo, distribuyendo las horas
     * por día según el máximo permitido y calculando los rangos de tiempo en UTC.
     *
     * Reglas:
     * - Tipos soportados en `type`: 'HEDDFs' | 'HENs' | 'HENDFs'.
     * - Para horaExtra.type 'HED' (diurna) se usa 18:00–21:00 UTC.
     * - Para horaExtra.type 'HEN' (nocturna) se usa 21:00–06:00 UTC (puede cruzar medianoche).
     * - Máximo por día configurado internamente (por defecto: 3 horas).
     *
     * Notas:
     * - Usa setUTCHours para evitar desfases por zona horaria del servidor.
     * - `quantity` es el total de horas a distribuir; `payment` es el total a prorratear.
     * - Retorna objeto con statusCode/message; en error no lanza excepción.
     *
     * @param {Array<{type: 'HED'|'HEN'|'HEDD'|'HEDN'|string, quantity: string|number, payment: string|number}>} horasExtrasData
     *        Conceptos de horas extra a procesar.
     * @param {'HEDDFs'|'HENs'|'HENDFs'} type
     *        Agrupación/colección objetivo a calcular.
     * @param {string|Date} dateFrom
     *        Inicio del periodo (inclusive). Acepta Date o 'YYYY-MM-DD'.
     * @param {string|Date} dateTo
     *        Fin del periodo (inclusive). Acepta Date o 'YYYY-MM-DD'.
     * @returns {{
     *   statusCode: number,
     *   message: string,
     *   data: Array<{
     *     start_time: Date,
     *     end_time: Date,
     *     quantity: number,
     *     payment: number,
     *     percentage: number
     *   }>
     * } | { success: false, error: true, message: string }}
     *
     * @example
     * const res = payrollService.extraTimeHours(
     *   [{ type: 'HEN', quantity: '10', payment: '170,455' }],
     *   'HENs',
     *   '2025-10-01',
     *   '2025-10-31'
     * );
     * if (res.statusCode === 200) {
     *   console.log(res.data); // [{ start_time: Date, end_time: Date, quantity, payment, percentage }, ...]
     * }
     */
    extraTimeHours(horasExtrasData, type, dateFrom, dateTo, FechasOcupadas) {
        try {
            if (!horasExtrasData || horasExtrasData.length == 0) {
                return { statusCode: 400, message: `No se proporcionaron datos de horas extras`, data: [] };
            }

            if (type !== 'HRNs' && type !== 'HENs' && type !== 'HRDDFs' && type !== 'HEDs' && type !== 'HRDs' && type !== 'HEDDFs' && type !== 'HENDFs' && type !== 'HRNDFs') {
                return { statusCode: 400, message: `El tipo de hora extra '${type}' no es válido`, data: [] };
            }

            const numberMaximumHoursExtra = {
                'HED': 3,
                'HEN': 3,
                'HRN': 3,
                'HEDDF': 3,
                'HRDDF': 3,
                'HENDF': 3,
                'HRNDF': 3,

            }

            const rangeHoursExtra = {
                'HED': [18, 21],
                'HEN': [21, 6],
                'HRN': [21, 6],
                'HEDDF': [8, 21],
                'HRDDF': [8, 21],
                'HENDF': [21, 6],
                'HRNDF': [21, 6],
            }

            const pergentage = {
                'HED': 1,
                'HEN': 2,
                'HRN': 3,
                'HRD': 4,
                'HRDDF': 5,
                'HENDF': 6,
                'HRNDF': 7
            }

            const response = [];
            //me voy a recorrer el arreglo de horas extras y voy a validar que el tipo sea valido
            for (const horaExtra of horasExtrasData) {
                //saco la cantidad de dias en base a las horas y las horas maximas por dia 
                let horasRestantes = Number(horaExtra.quantity);
                let laps = horasRestantes <= numberMaximumHoursExtra[horaExtra.type] ? 1 : Math.ceil(horasRestantes / numberMaximumHoursExtra[horaExtra.type]);

                //saco el precio a calcular
                const payable = Number(horaExtra.payment);
                let pay = payable / (horaExtra.quantity);

                //obtengo el dia de la semana
                const initDay = new Date(dateFrom);

                let weekDay = initDay.getUTCDay();

                for (let i = 0; horasRestantes > 0 && FechasOcupadas.length > i; i++) {
                    if (FechasOcupadas[i][String(i + 1)]) continue;

                    //ahora armo la lista de dias con las horas extras
                    //Para asignar necesito saber la fecha de inicio y fin del perido de nomina porque las horas extra vienen sin esa data
                    //para las horas extra entre semana voy a asignar los dias de lunes a sabado

                    //definir los dias y horas para las horas extras
                    const dayInit = new Date(dateFrom);
                    const dayEnd = new Date(dateFrom);

                    dayInit.setUTCHours(rangeHoursExtra[horaExtra.type][0], 0, 0);
                    const hoursToAssign = horasRestantes < Math.ceil(Number(horaExtra.quantity) / laps) ? horasRestantes : Math.floor(Number(horaExtra.quantity) / laps)
                    dayEnd.setUTCHours(rangeHoursExtra[horaExtra.type][0] + hoursToAssign, 0, 0);
                    const payable_amount = pay * hoursToAssign;
                    if (weekDay != 0 && (horaExtra.type == 'HED' || horaExtra.type == 'HEN' || horaExtra.type == 'HRN')) {
                        response.push({
                            start_time: new Date(dayInit.setDate(dayInit.getUTCDay() + i)),
                            end_time: new Date(dayEnd.setDate(dayEnd.getUTCDay() + i)),
                            quantity: hoursToAssign,
                            payment: payable_amount,
                            percentage: pergentage[horaExtra.type]
                        });

                        horasRestantes -= Math.floor(horaExtra.quantity / laps);

                    } else if (weekDay == 0 && (horaExtra.type == 'HRDDF' || horaExtra.type == 'HEDDF' || horaExtra.type == 'HENDF' || horaExtra.type == 'HRNDF')) {
                        //Domingo
                        response.push({
                            start_time: new Date(dayInit.setDate(dayInit.getUTCDay() + i)),
                            end_time: new Date(dayEnd.setDate(dayEnd.getUTCDay() + i)),
                            quantity: hoursToAssign,
                            payment: payable_amount,
                            percentage: pergentage[horaExtra.type]
                        });
                        horasRestantes -= Math.floor(horaExtra.quantity / laps);
                    }
                    (weekDay + 1) == 7 ? weekDay = 0 : weekDay++;
                }


            }
            return { statusCode: 200, message: `Horas extras procesadas correctamente`, data: response };

        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },

    /**
     * Inicializa y marca días ocupados de un mes en UTC.
     *
     * - Recorre el mes de `fechaInicioPeriodo` (UTC) del día 1 al último.
     * - Llena `mes` con objetos { 'día': boolean } empezando en false.
     * - Por cada rango en `fechas` ([date, date_to]), marca true los días incluidos.
     *
     * Nota: La función muta el arreglo `mes` (lo llena/actualiza). Usa fechas a las 00:00:00.000Z.
     *
     * @param {Array<Record<string, boolean>>} mes
     *        Arreglo a mutar. Recibirá elementos tipo { '1': false }, { '2': true }, ... hasta 28–31.
     * @param {Date} fechaInicioPeriodo
     *        Fecha base para determinar año/mes (se usa su año/mes en UTC).
     * @param {Array<{date: string|Date, date_to: string|Date}>} [fechas=[]]
     *        Rangos de fechas (inclusive) a marcar como ocupadas dentro del mes objetivo.
     * @returns {void | { success: false, error: true, message: string, data: [] }}
     *        No retorna nada en éxito; en error retorna objeto con detalle.
     *
     * @example
     * const mes = [];
     * arregloDiasOcupados(
     *   mes,
     *   new Date('2025-10-01'),
     *   [{ date: '2025-10-05', date_to: '2025-10-08' }]
     * );
     * // mes[4]['5'] === true, mes[5]['6'] === true, mes[6]['7'] === true, mes[7]['8'] === true
     */
    arregloDiasOcupados(mes, fechaInicioPeriodo, fechas = []) {
        try {

            const primero_de_mes = new Date(Date.UTC(fechaInicioPeriodo.getUTCFullYear(), fechaInicioPeriodo.getUTCMonth(), 1));

            for (let d = primero_de_mes; d <= new Date(Date.UTC(fechaInicioPeriodo.getUTCFullYear(), fechaInicioPeriodo.getUTCMonth() + 1, 0)); d.setUTCDate(d.getUTCDate() + 1)) {
                mes.push({ [d.getUTCDate()]: false });
            }

            if (!fechas) return;

            for (const fecha of fechas) {

                const date = new Date(excelDateToJSDate(fecha?.date));
                const date_to = new Date(excelDateToJSDate(fecha?.date_to));
                const iterador_dias = new Date(Date.UTC(fechaInicioPeriodo.getUTCFullYear(), fechaInicioPeriodo.getUTCMonth(), 1));

                //me recorro los dias y marco como true los ocupados en el rango de fechas
                for (let d = iterador_dias; d <= new Date(Date.UTC(fechaInicioPeriodo.getUTCFullYear(), fechaInicioPeriodo.getUTCMonth() + 1, 0)); d.setUTCDate(d.getUTCDate() + 1)) {
                    if (d >= date && d <= date_to) {
                        mes[d.getUTCDate() - 1][`${d.getUTCDate()}`] = true;
                    }
                }

            }

        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    }
}

module.exports = payrollService;
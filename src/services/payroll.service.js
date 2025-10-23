//Imports odoo connection
const odooConector = require("../utils/odoo.service");


//Imports services
const employeeService = require("../services/employee.service");
const moveService = require("../services/bills.service");
const bankAccountService = require("../services/bankAccount.service");
const workEntryService = require("../services/workEntry.service");
const nextPymeService = require("../services/nextPyme.service");
//Utils
const util_date = require("../utils/date");
const XLSX = require('xlsx');
const { payrollStruct } = require("../structs/payroll/payrrol.struct");

// Imports repositories
const paramsTypeDocumentIdentificationRepository = require("../Repository/params_type_document_identification.repository/params_type_document_identification.repository");
const paramsMunicipalitiesRepository = require("../Repository/params_municipalities/params_municipalities.repository");
const paramsPaymentMethodsRepository = require("../Repository/params_payment_methods/params_payment_methods.repository");
const { ca, is, de } = require("zod/locales");
const { excelDateToJSDate } = require("../utils/attachements.util");
const { type } = require("../schemas/product.schema");
const { util } = require("zod");

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
            //const transportaion_allowance =



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
    /**
     * Construye el JSON de una nómina a partir del payslip id en Odoo.
     *
     * Flujo:
     *  - Valida el id de nómina.
     *  - Recupera la nómina con `getpayrollById`.
     *  - Recupera datos del empleado, contactos, contrato, cuenta bancaria y asientos contables.
     *  - Calcula periodos, días trabajados, devengados y arma el objeto `payrollJson` listo para reportar.
     *
     * Comportamiento de errores:
     *  - Retorna objetos con statusCode 400 cuando faltan datos obligatorios o el id es inválido.
     *  - Retorna statusCode 404 cuando no se encuentran recursos de parámetros (municipio, tipo de documento, etc.).
     *  - Retorna statusCode 500 cuando fallan llamadas a servicios externos.
     *  - En excepción interna retorna { statusCode: 500, success: false, error: true, message, data: [] }.
     *
     * @async
     * @param {number|string} id
     *        Id del payslip (acepta número o string convertible a número).
     *
     * @returns {Promise<
     *   { statusCode: 200, message: string, data: Object } |
     *   { statusCode: 400|404|500, message: string, error?: any, data?: any } |
     *   { statusCode: 500, success: false, error: true, message: string, data: [] }
     * >}
     *
     * @example
     * const res = await payrollService.getJsonPayrollById(123);
     * if (res.statusCode === 200) console.log(res.data); // JSON de la nómina listo para enviar
     */
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

    /**
     * Recupera las nóminas entre dos fechas y enriquece cada nómina con sus líneas
     * y los días trabajados asociados.
     *
     * Flujo:
     *  - Valida y normaliza las fechas (`startDate` y `endDate`) a YYYY-MM-DD.
     *  - Consulta `hr.payslip` mediante Odoo (`search_read`) en el rango indicado.
     *  - Para cada nómina recuperada obtiene sus líneas (`hr.payslip.line`) y los
     *    registros de días trabajados (`hr.payslip.worked_days`) y los adjunta.
     *
     * Comportamiento de errores:
     *  - Si faltan fechas o son inválidas retorna statusCode 400.
     *  - Si alguna llamada a Odoo falla retorna objetos con statusCode 400 o 500
     *    según el error recibido.
     *  - En excepción interna retorna statusCode 500 con mensaje genérico.
     *
     * @async
     * @param {string|Date} startDate
     *        Fecha de inicio del rango (acepta valores convertibles a Date).
     * @param {string|Date} endDate
     *        Fecha fin del rango (acepta valores convertibles a Date).
     *
     * @returns {Promise<
     *   { statusCode: 200, message: string, data: Array<Object> } |
     *   { statusCode: 400|500, message: string, data?: any } |
     *   { statusCode: 500, success: false, error: true, message: string }
     * >}
     *
     * - Éxito: statusCode 200 y `data` contiene las nóminas con `line_ids` y `worked_days_ids`.
     * - Errores: retorna objetos con statusCode y mensaje explicando la causa.
     *
     * @example
     * const res = await payrollService.getPayrollsByDates('2025-10-01', '2025-10-31');
     * if (res.statusCode === 200) console.log(res.data); // array de nóminas con detalles
     */
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

    /**
     * Recupera los asientos contables (moves) asociados a una nómina.
     *
     * Flujo:
     *  - Valida que `payrollId` sea numérico y mayor a 0.
     *  - Verifica que la nómina exista llamando a `getpayrollById`.
     *  - Llama a Odoo (`hr.payslip` -> `action_open_move`) para obtener los IDs de los asientos.
     *  - Recupera cada asiento con `moveService.getOneBill` y devuelve sus datos.
     *
     * Comportamiento de errores:
     *  - Si `payrollId` no es válido retorna { statusCode: 400, message, data: [] }.
     *  - Si `getpayrollById` falla, propaga su resultado.
     *  - Si la llamada a Odoo falla retorna objetos con statusCode 500 o 400 según corresponda.
     *  - Si no se encuentran asientos para la nómina retorna { statusCode: 404, message, data: [] }.
     *  - En excepción interna retorna { success: false, error: true, message: 'Error interno del servidor' }.
     *
     * @async
     * @param {number|string} payrollId
     *        Id de la nómina (acepta número o string convertible a número).
     *
     * @returns {Promise<
     *   { statusCode: 200, message: string, data: Array<Object> } |
     *   { statusCode: 400|404|500, message: string, data?: any } |
     *   { success: false, error: true, message: string }
     * >}
     *
     * @example
     * const res = await payrollService.getMovesByPayrollId(123);
     * if (res.statusCode === 200) console.log(res.data); // array de asientos
     */
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

    /**
     * Reporta nóminas entre dos fechas y devuelve un arreglo de JSONs agrupados por empleado.
     *
     * Flujo:
     *  - Recupera las nóminas en el rango con `getPayrollsByDates`.
     *  - Agrupa las nóminas por empleado.
     *  - Para cada empleado genera el JSON de nómina con `getJsonPayrolls`.
     *
     * Comportamiento:
     *  - Si `getPayrollsByDates` devuelve un error, lo propaga tal cual.
     *  - Para cada empleado añade el resultado exitoso ({ statusCode: 200, data: ... }) o un objeto
     *    con { message, data: error } si `getJsonPayrolls` falla.
     *  - En excepción interna retorna { statusCode: 500, success: false, error: true, message }.
     *
     * @async
     * @param {string} [startDate='2025/10/01']
     *        Fecha de inicio del rango (acepta cualquier valor convertible a Date). Se normaliza a YYYY-MM-DD.
     * @param {string} [endDate='2025/10/31']
     *        Fecha fin del rango (acepta cualquier valor convertible a Date). Se normaliza a YYYY-MM-DD.
     *
     * @returns {Promise<
     *   { statusCode: 200, message: string, data: Array<Object> } |
     *   { statusCode: number, message: string, data?: any } |
     *   { statusCode: 500, success: false, error: true, message: string }
     * >}
     *
     * - Éxito: statusCode 200 y `data` es un array con los JSONs por empleado (o objetos de error por empleado).
     * - Si `getPayrollsByDates` falla, se retorna su objeto de error.
     * - En caso de excepción no controlada se retorna un objeto con statusCode 500.
     *
     * @example
     * const res = await payrollService.reportPayrollsByDates('2025-10-01', '2025-10-31');
     * if (res.statusCode === 200) console.log(res.data);
     */
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


    /**
     * Genera un objeto trabajador (worker) para nómina a partir de los datos de una fila de Excel.
     * 
     * Extrae y valida información del empleado desde una fila del archivo Excel, construyendo
     * un objeto que cumple con la estructura requerida para el reporte de nómina electrónica.
     * 
     * @param {Object} row - Fila de datos del Excel con información del empleado
     * @param {number} row.sueldo_contrato - Salario contractual del empleado (obligatorio)
     * @param {string} row.direccion - Dirección del empleado (obligatorio)
     * @param {string} row.primer_nombre - Primer nombre del empleado (obligatorio)
     * @param {string} [row.segundo_nombre] - Segundo nombre del empleado (opcional)
     * @param {string} row.primer_apellido - Primer apellido del empleado (obligatorio)
     * @param {string} [row.segundo_apellido] - Segundo apellido del empleado (opcional)
     * @param {number} row.tipo_empleado - ID del tipo de empleado (obligatorio)
     * @param {number} row.municipio - ID del municipio (obligatorio)
     * @param {number} row.tipo_contrato - ID del tipo de contrato (obligatorio)
     * @param {string} [row.pensionado] - "Si" si tiene pensión de riesgo, otro valor si no
     * @param {string} [row.tipo_salario] - "Integral" si es salario integral, otro valor si no
     * @param {number} row.subtipo_empleado - ID del subtipo de empleado (obligatorio)
     * @param {string|number} row.cedula - Número de identificación del empleado (obligatorio)
     * @param {number} row.tipo_documento - ID del tipo de documento de identificación (obligatorio)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Object|Array
     * }} Objeto con resultado de la operación
     * 
     */
    generate_payroll_worker_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion del trabajador', data: [] };

        //Extraigo la informacion del trabajador
        const salary = Number(row.sueldo_contrato);
        const address = row.direccion;
        const first_name = row.primer_nombre;
        const middle_name = row.segundo_nombre ? row.segundo_nombre : null;
        const surname = row.primer_apellido;
        const second_surname = row.segundo_apellido ? row.segundo_apellido : null;
        const type_worker_id = Number(row.tipo_empleado);
        const municipality_id = Number(row.municipio);
        const type_contract_id = Number(row.tipo_contrato);
        const high_risk_pension = row.pensionado == 'Si' ? true : false;
        const integral_salarary = row.tipo_salario == 'Integral' ? true : false;
        const sub_type_worker_id = Number(row.subtipo_empleado);
        const identification_number = row.cedula;
        const payroll_type_document_identification_id = Number(row.tipo_documento);

        //Verifico que los campos obligatorios esten completos
        if (!salary || isNaN(salary)) return { error: true, message: 'El campo sueldo_contrato es obligatorio y debe ser un número válido', data: [] };
        if (!address) return { error: true, message: 'El campo direccion es obligatorio', data: [] };
        if (!first_name) return { error: true, message: 'El campo primer_nombre es obligatorio', data: [] };
        if (!surname) return { error: true, message: 'El campo primer_apellido es obligatorio', data: [] };
        if (!type_worker_id || isNaN(type_worker_id)) return { error: true, message: 'El campo tipo_empleado es obligatorio y debe ser un número válido', data: [] };
        if (!municipality_id || isNaN(municipality_id)) return { error: true, message: 'El campo municipio es obligatorio y debe ser un número válido', data: [] };
        if (!type_contract_id || isNaN(type_contract_id)) return { error: true, message: 'El campo tipo_contrato es obligatorio y debe ser un número válido', data: [] };
        if (!sub_type_worker_id || isNaN(sub_type_worker_id)) return { error: true, message: 'El campo subtipo_empleado es obligatorio y debe ser un número válido', data: [] };
        if (!identification_number) return { error: true, message: 'El campo cedula es obligatorio', data: [] };
        if (!payroll_type_document_identification_id || isNaN(payroll_type_document_identification_id)) return { error: true, message: 'El campo tipo_documento es obligatorio y debe ser un número válido', data: [] };

        //Construyo el objeto trabajador
        let worker = {
            salary: salary.toFixed(2),
            address: address,
            first_name: first_name,
            middle_name: middle_name,
            surname: surname,
            second_surname: second_surname,
            type_worker_id: type_worker_id,
            municipality_id: municipality_id,
            type_contract_id: type_contract_id,
            high_risk_pension: high_risk_pension,
            integral_salarary: integral_salarary,
            sub_type_worker_id: sub_type_worker_id,
            identification_number: identification_number,
            payroll_type_document_identification_id: payroll_type_document_identification_id,
        }

        //Retorno el objeto trabajador
        return { error: false, message: 'Objeto trabajador generado correctamente', data: worker };
    },


    /**
     * Genera un objeto de pago (payment) para nómina a partir de los datos de una fila de Excel.
     * 
     * Extrae y valida la información de pago del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el procesamiento
     * de pagos en nóminas electrónicas.
     * 
     * Funcionalidad:
     * - Extrae información bancaria: nombre del banco, número de cuenta, tipo de cuenta
     * - Valida el método de pago configurado para el empleado
     * - Asegura que todos los campos obligatorios estén presentes y sean válidos
     * - Convierte el número de cuenta a string para evitar problemas de formato
     * * 
     * @param {Object} row - Fila de datos del Excel con información de pago del empleado
     * @param {string} row.banco - Nombre del banco donde el empleado tiene la cuenta (obligatorio)
     * @param {string|number} row.numero_cuenta - Número de cuenta bancaria del empleado (obligatorio)
     * @param {string} row.tipo_cuenta - Tipo de cuenta bancaria (ej: "Ahorros", "Corriente") (obligatorio)
     * @param {number} row.metodo_pago - ID del método de pago configurado en el sistema (obligatorio)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Object|Array
     * }} Objeto con resultado de la operación
     * 
     */
    generate_payroll_payment_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion del pago', data: [] };

        //Extraigo la informacion del pago
        const bank_name = row.banco;
        const account_number = row.numero_cuenta;
        const account_type = row.tipo_cuenta;
        const payment_method_id = Number(row.metodo_pago);

        //Verifico que los campos obligatorios esten completos
        if (!bank_name) return { error: true, message: 'El campo banco es obligatorio', data: [] };
        if (!account_number) return { error: true, message: 'El campo numero_cuenta es obligatorio', data: [] };
        if (!account_type) return { error: true, message: 'El campo tipo_cuenta es obligatorio', data: [] };
        if (!payment_method_id || isNaN(payment_method_id)) return { error: true, message: 'El campo metodo_pago es obligatorio y debe ser un número válido', data: [] };

        //Construyo el objeto de pago
        const payment = {
            payment_method_id: payment_method_id,
            bank_name: bank_name,
            account_number: (account_number).toString(),
            account_type: account_type
        }

        //Retorno el objeto pago
        return { error: false, message: 'Objeto pago generado correctamente', data: payment };
    },

    generate_payroll_accrued_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de los devengados', data: [] };

        //Extraigo la informacion de los devengados
        const worked_days = Number(row.dias);
        const salary = Number(row.sueldo_basico);
        const accrued_total = Number(row.total_devengado);
        let transportation_allowance = null;
        let endowment = null;
        let bonuses = [];
        let common_vacation = [];
        let paid_vacation = [];
        let work_disabilities = [];
        let maternity_leave = [];
        let severance = [];
        let service_bonus = [];
        let aid = [];

        //Subsidio de transporte
        if (row.auxilio_transporte) {
            transportation_allowance = Number(row.auxilio_transporte);
            if (isNaN(transportation_allowance)) return { error: true, message: 'El campo auxilio_transporte debe ser un número válido', data: [] };

            //Agrego el auxilio de transporte a el salario
            transportation_allowance = transportation_allowance;
        }

        //Dotacion
        if (row.dotacion) {
            endowment = Number(row.dotacion);
            if (isNaN(endowment) || endowment <= 0) return { error: true, message: 'El campo dotacion debe ser un número válido', data: [] };

            //Agrego la dotacion a el salario
            endowment = endowment;
        }

        //Bonos salariales y no salariales
        bonuses = this.generate_accrued_bonuses_object(row);
        if (bonuses.error) return bonuses;
        if (bonuses.data) bonuses = [bonuses.data];

        //Vacaciones disfrutadas
        common_vacation = this.generate_accrued_common_vacation_object(row);
        if (common_vacation.error) return common_vacation;
        if (common_vacation.data) common_vacation = [common_vacation.data];

        //Vacaciones compensadas
        paid_vacation = this.generate_accrued_paid_vacation_object(row);
        if (paid_vacation.error) return paid_vacation;
        if (paid_vacation.data) paid_vacation = [paid_vacation.data];

        //Discapacidades laborales
        work_disabilities = this.generate_accrued_work_disabilities_object(row);
        if (work_disabilities.error) return work_disabilities;
        if (work_disabilities.data) work_disabilities = [work_disabilities.data];

        //Licencia de maternidad
        maternity_leave = this.generate_accrued_maternity_leave_object(row);
        if (maternity_leave.error) return maternity_leave;
        if (maternity_leave.data) maternity_leave = [maternity_leave.data];

        //Licencia de paternidad
        //Reasigno los valores de licencia de paternidad a los de maternidad para reutilizar la funcion
        row.lm = row.lp;
        row.licencia_maternidad = row.licencia_paternidad;
        row.licencia_maternidad_fecha_inicial = row.licencia_paternidad_fecha_inicial;
        row.licencia_maternidad_fecha_final = row.licencia_paternidad_fecha_final;
        const paternity_leave = this.generate_accrued_maternity_leave_object(row);
        if (paternity_leave.error) return paternity_leave;
        if (paternity_leave.data) maternity_leave.push(paternity_leave.data);

        //Cesantias
        severance = this.generate_accrued_severance_object(row);
        if (severance.error) return severance;
        if (severance.data) severance = [severance.data];

        //Primas
        service_bonus = this.generate_accrued_service_bonus_object(row);
        if (service_bonus.error) return service_bonus;
        if (service_bonus.data) service_bonus = [service_bonus.data];

        //Verifico que los campos obligatorios esten completos
        if (!worked_days || isNaN(worked_days)) return { error: true, message: 'El campo dias_trabajados es obligatorio y debe ser un número válido', data: [] };
        if (!salary || isNaN(salary)) return { error: true, message: 'El campo salario es obligatorio y debe ser un número válido', data: [] };
        if (!accrued_total || isNaN(accrued_total)) return { error: true, message: 'El campo total_devengado es obligatorio y debe ser un número válido', data: [] };

        //Auxilios salariales y no salariales
        aid = this.generate_accrued_salary_allowance_object(row);
        if (aid.error) return aid;
        if (aid.data) aid = [aid.data];

        //Construyo el objeto de devengados
        const accrued = {};

        accrued.worked_days = worked_days;
        accrued.salary = salary.toFixed(2);
        accrued.accrued_total = accrued_total.toFixed(2);
        if (transportation_allowance !== null) accrued.transportation_allowance = transportation_allowance.toFixed(2);
        if (endowment !== null) accrued.endowment = endowment.toFixed(2);
        if (bonuses.length > 0) accrued.bonuses = bonuses;
        if (common_vacation.length > 0) accrued.common_vacation = common_vacation;
        if (paid_vacation.length > 0) accrued.paid_vacation = paid_vacation;
        if (work_disabilities.length > 0) accrued.work_disabilities = work_disabilities;
        if (maternity_leave.length > 0) accrued.maternity_leave = maternity_leave;
        if (severance.length > 0) accrued.severance = severance;
        if (service_bonus.length > 0) accrued.service_bonus = service_bonus;
        if (aid.length > 0) accrued.aid = aid;

        //Retorno el objeto devengados
        return { error: false, message: 'Objeto devengados generado correctamente', data: accrued };
    },


    /**
     * Genera un objeto de auxilios salariales y no salariales (salary allowances) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * @param {Object} row - Fila de datos del Excel con información de auxilios del empleado
     * @param {number|string} [row.auxilio_salarial] - Valor monetario del auxilio salarial (opcional)
     * @param {number|string} [row.auxilio_no_salarial] - Valor monetario del auxilio no salarial (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Object|null|Array
     * }} Objeto con resultado de la operación
     */
    generate_accrued_salary_allowance_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de los auxilios', data: [] };

        //Extraigo la informacion de los auxilios
        const salary_assistance = Number(row.auxilio_salarial);
        const non_salary_assistance = Number(row.auxilio_no_salarial);

        //Verifico si hay auxilios
        if (!row.auxilio_salarial && !row.auxilio_no_salarial) return { error: false, message: 'No hay auxilios', data: null };

        //Verifico que los campos sean validos
        if (row.auxilio_salarial && (isNaN(salary_assistance) || salary_assistance <= 0)) return { error: true, message: 'El campo auxilio_salarial debe ser un número válido y mayor a 0', data: [] };
        if (row.auxilio_no_salarial && (isNaN(non_salary_assistance) || non_salary_assistance <= 0)) return { error: true, message: 'El campo auxilio_no_salarial debe ser un número válido y mayor a 0', data: [] };

        //Construyo el objeto de auxilios
        const aid = {};
        if (row.auxilio_salarial) aid.salary_assistance = salary_assistance.toFixed(2);
        if (row.auxilio_no_salarial) aid.non_salary_assistance = non_salary_assistance.toFixed(2);
        return { error: false, message: 'Objeto de auxilios generado correctamente', data: aid };
    },

    /**
     * Genera un objeto de primas de servicios (service bonus) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de prima de servicios del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN colombiana y regulaciones laborales de primas de servicios.
     * 
     * @param {Object} row - Fila de datos del Excel con información de prima de servicios del empleado
     * @param {number|string} [row.prima_servicios] - Valor monetario pagado por prima de servicios (opcional)
     * @param {number|string} row.sueldo_contrato - Salario contractual mensual del empleado (obligatorio para cálculo)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Object|null|Array
     * }} 
     */
    generate_accrued_service_bonus_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las primas', data: [] };

        //Verifico si hay primas
        if (!row.prima_servicios) return { error: false, message: 'No hay primas', data: null };

        //Extraigo la informacion de las primas
        const payment = Number(row.prima_servicios);
        const salary_worker = Number(row.sueldo_contrato);

        //Verifico que los campos sean validos
        if (isNaN(payment) || payment <= 0) return { error: true, message: 'El campo prima_servicios debe ser un número válido y mayor a 0', data: [] };
        if (isNaN(salary_worker) || salary_worker <= 0) return { error: true, message: 'El campo sueldo_contrato debe ser un número válido y mayor a 0', data: [] };

        //Calculo los dias trabajados
        //const service_bonus_days = Math.round((payment * 360) / salary_worker);

        //Construyo el objeto de primas
        const service_bonus = {
            payment: payment.toFixed(2),    
            quantity: 180,
            paymentNS: "0.00"
        };

        return { error: false, message: 'Objeto de primas generado correctamente', data: service_bonus };
    },

    /**
     * Genera un objeto de cesantías (severance) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de cesantías del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN colombiana y regulaciones laborales de cesantías.
     * 
     * Funcionalidad Principal:
     * - Extrae información del pago de cesantías y sus intereses correspondientes
     * - Valida que los valores monetarios sean numéricos y positivos
     * - Formatea valores monetarios con 2 decimales para cumplir estándares contables
     * - Maneja casos donde no hay cesantías (retorna null)
     * - Aplica porcentaje estándar del 12% anual según normativa colombiana
     * - Construye estructura requerida por la API de nómina electrónica
     * 
     * @param {Object} row - Fila de datos del Excel con información de cesantías del empleado
     * @param {number|string} [row.cesantia] - Valor monetario del pago de cesantías (opcional)
     * @param {number|string} [row.intereses_cesantias] - Valor de los intereses sobre cesantías (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Object|null|Array
     * }} 
     */
    generate_accrued_severance_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las cesantias', data: [] };

        //Verifico si hay cesantias
        if (!row.cesantia) return { error: false, message: 'No hay cesantias', data: null };

        //Extraigo la informacion de las cesantias
        const severance_payment = Number(row.cesantia);
        const interest_severance_payment = Number(row.intereses_cesantias);

        //Verifico que los campos sean validos
        if (isNaN(severance_payment) || severance_payment <= 0) return { error: true, message: 'El campo cesantia debe ser un número válido y mayor a 0', data: [] };
        if (isNaN(interest_severance_payment) || interest_severance_payment < 0) return { error: true, message: 'El campo intereses_cesantias debe ser un número válido y mayor o igual a 0', data: [] };

        //Construyo el objeto de cesantias
        const severance = {
            payment: severance_payment.toFixed(2),
            interest_payment: interest_severance_payment.toFixed(2),
            percentage: "12"
        };

        return { error: false, message: 'Objeto cesantias generado correctamente', data: severance };
    },

    /**
     * Genera un objeto de licencia de maternidad (maternity leave) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de licencia de maternidad del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN colombiana y regulaciones laborales de maternidad.
     * 
     * Funcionalidad Principal:
     * - Extrae información de días de licencia, pago y fechas de la licencia de maternidad
     * - Valida coherencia entre fechas de inicio/fin y días reportados
     * - Convierte fechas Excel a formato JavaScript estándar (ISO 8601)
     * - Formatea valores monetarios con 2 decimales para cumplir estándares contables
     * - Maneja casos donde no hay licencia de maternidad (retorna null)
     * - Construye estructura de array requerida por la API de nómina electrónica
     * 
     * @param {Object} row - Fila de datos del Excel con información de licencia de maternidad del empleado
     * @param {number|string} [row.lm] - Número de días de licencia de maternidad (LM = Licencia Maternidad) (opcional)
     * @param {number|string} [row.licencia_maternidad] - Valor monetario pagado por la licencia de maternidad (opcional)
     * @param {number|Date|string} [row.licencia_maternidad_fecha_inicial] - Fecha de inicio de la licencia en formato Excel (opcional)
     * @param {number|Date|string} [row.licencia_maternidad_fecha_final] - Fecha de fin de la licencia en formato Excel (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Array<Object>|null|Array
     * }} Objeto con resultado de la operación
     * 
     */
    generate_accrued_maternity_leave_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de la licencia de maternidad', data: [] };

        //Verifico si hay licencia de maternidad
        if (!row.lm) return { error: false, message: 'No hay licencia de maternidad', data: null };

        //Extraigo la informacion de la licencia de maternidad
        const maternity_days = Number(row.lm);
        const maternity_payment = Number(row.licencia_maternidad);
        const start_date = new Date(excelDateToJSDate(row.licencia_maternidad_fecha_inicial));
        const end_date = new Date(excelDateToJSDate(row.licencia_maternidad_fecha_final));

        //Verifico que los campos sean validos
        if (isNaN(maternity_days) || maternity_days <= 0) return { error: true, message: 'El campo dias_licencia_maternidad debe ser un número válido y mayor a 0', data: [] };
        if (isNaN(maternity_payment) || maternity_payment <= 0) return { error: true, message: 'El campo licencia_maternidad debe ser un número válido y mayor a 0', data: [] };
        if (!row.licencia_maternidad_fecha_inicial || !util_date.canBeParsedAsDate(row.licencia_maternidad_fecha_inicial)) return { error: true, message: 'El campo licencia_maternidad_fecha_inicial debe ser una fecha válida', data: [] };
        if (!row.licencia_maternidad_fecha_final || !util_date.canBeParsedAsDate(row.licencia_maternidad_fecha_final)) return { error: true, message: 'El campo licencia_maternidad_fecha_final debe ser una fecha válida', data: [] };

        //Verifico que la diferencia entre las fechas sea igual a los dias de licencia de maternidad
        const time_difference = util_date.getDiffDates(start_date, end_date);
        if (time_difference != maternity_days) return { error: true, message: `La diferencia entre licencia_maternidad_fecha_inicial y licencia_maternidad_fecha_final debe ser igual a ${maternity_days} días`, data: [] };

        //Construyo el objeto de licencia de maternidad
        const maternity_leave = {
            quantity: maternity_days,
            payment: maternity_payment.toFixed(2),
            start_date: start_date.toISOString().split('T')[0],
            end_date: end_date.toISOString().split('T')[0]
        };
        return { error: false, message: 'Objeto licencia de maternidad generado correctamente', data: maternity_leave };
    },

    /**
     * Genera un objeto de incapacidades laborales (work disabilities) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de incapacidades laborales del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN colombiana y regulaciones del Sistema de Seguridad Social.
     * 
     * Funcionalidad Principal:
     * - Extrae información de días de incapacidad, pago, tipo y fechas de la incapacidad
     * - Valida coherencia entre fechas de inicio/fin y días reportados
     * - Convierte fechas Excel a formato JavaScript estándar (ISO 8601)
     * - Formatea valores monetarios con 2 decimales para cumplir estándares contables
     * - Maneja casos donde no hay incapacidades (retorna null)
     * - Construye estructura de array requerida por la API de nómina electrónica
     * 
     * 
     * @param {Object} row - Fila de datos del Excel con información de incapacidades del empleado
     * @param {number|string} [row.ieg] - Número de días de incapacidad (IEG = Incapacidad Enfermedad General) (opcional)
     * @param {number|string} [row.incapacidad_general] - Valor monetario pagado por la incapacidad (opcional)
     * @param {number|string} [row.incapacidad_tipo] - Código del tipo de incapacidad según DIAN (opcional)
     * @param {number|Date|string} [row.incapacidad_fecha_inicial] - Fecha de inicio de la incapacidad en formato Excel (opcional)
     * @param {number|Date|string} [row.incapacidad_fecha_final] - Fecha de fin de la incapacidad en formato Excel (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Array<Object>|null|Array
     * }} 
     */
    generate_accrued_work_disabilities_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las incapacidades laborales', data: [] };

        //Verifico si hay incapacidades laborales
        if (!row.ieg) return { error: false, message: 'No hay incapacidades laborales', data: null };

        //Extraigo la informacion de las incapacidades laborales
        const disability_days = Number(row.ieg);
        const disability_payment = Number(row.incapacidad_general);
        const type_disability = Number(row.incapacidad_tipo);
        const start_date = new Date(excelDateToJSDate(row.incapacidad_fecha_inicial));
        const end_date = new Date(excelDateToJSDate(row.incapacidad_fecha_final));

        //Verifico que los campos sean validos
        if (isNaN(disability_days) || disability_days <= 0) return { error: true, message: 'El campo ieg debe ser un número válido y mayor a 0', data: [] };
        if (isNaN(disability_payment) || disability_payment <= 0) return { error: true, message: 'El campo incapacidad_general debe ser un número válido y mayor a 0', data: [] };
        if (isNaN(type_disability) || type_disability <= 0) return { error: true, message: 'El campo incapacidad_tipo debe ser un número válido y mayor a 0', data: [] };
        if (!row.incapacidad_fecha_inicial || !util_date.canBeParsedAsDate(row.incapacidad_fecha_inicial)) return { error: true, message: 'El campo incapacidad_fecha_inicial debe ser una fecha válida', data: [] };
        if (!row.incapacidad_fecha_final || !util_date.canBeParsedAsDate(row.incapacidad_fecha_final)) return { error: true, message: 'El campo incapacidad_fecha_final debe ser una fecha válida', data: [] };

        //Verifico que la diferencia entre las fechas sea igual a los dias de incapacidad
        const time_difference = util_date.getDiffDates(start_date, end_date);

        if (time_difference != disability_days) return { error: true, message: `La diferencia entre incapacidad_fecha_inicial y incapacidad_fecha_final debe ser igual a ${disability_days} días`, data: [] };

        //Construyo el objeto de incapacidades laborales
        const work_disability = {
            quantity: disability_days,
            payment: disability_payment.toFixed(2),
            type: type_disability,
            start_date: start_date.toISOString().split('T')[0],
            end_date: end_date.toISOString().split('T')[0]
        };

        return { error: false, message: 'Objeto incapacidades laborales generado correctamente', data: work_disability };
    },

    /**
     * Genera un objeto de vacaciones compensadas (paid vacation) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de vacaciones compensadas del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN colombiana.
     * 
     * Funcionalidad Principal:
     * - Extrae información de días de vacaciones compensadas y su valor monetario
     * - Valida que los valores sean numéricos y mayores a cero
     * - Maneja casos donde no hay vacaciones compensadas (retorna null)
     * - Formatea valores monetarios con 2 decimales para cumplir estándares contables
     * - Construye estructura de array requerida por la API de nómina electrónica
     * 
     * @param {Object} row - Fila de datos del Excel con información de vacaciones compensadas del empleado
     * @param {number|string} [row.vacaciones_compensadas_dias] - Número de días de vacaciones compensadas (opcional)
     * @param {number|string} [row.vacaciones_compensadas] - Valor monetario pagado por las vacaciones compensadas (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Array<Object>|null|Array
     * }} 
     */
    generate_accrued_paid_vacation_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las vacaciones compensadas', data: [] };

        //Verifico si hay vacaciones compensadas
        if (!row.vacaciones_compensadas_dias) return { error: false, message: 'No hay vacaciones compensadas', data: null };

        //Extraigo la informacion de las vacaciones compensadas
        const vacation_days = Number(row.vacaciones_compensadas_dias);
        const vacation_payment = Number(row.vacaciones_compensadas);

        //Verifico que los campos sean validos
        if (isNaN(vacation_days) || vacation_days <= 0) return { error: true, message: 'El campo vacaciones_compensadas_dias debe ser un número válido y mayor a 0', data: [] };
        if (isNaN(vacation_payment) || vacation_payment <= 0) return { error: true, message: 'El campo vacaciones_compensadas_valor debe ser un número válido y mayor a 0', data: [] };

        //Construyo el objeto de vacaciones compensadas
        const paid_vacation = {
            quantity: vacation_days,
            payment: vacation_payment.toFixed(2)
        };

        return { error: false, message: 'Objeto vacaciones compensadas generado correctamente', data: paid_vacation };
    },


    /**
     * Genera un objeto de bonos (bonuses) para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida los bonos salariales y no salariales del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN.
     * 
     * Funcionalidad:
     * - Extrae información de bonos salariales y no salariales
     * - Valida que los valores sean numéricos cuando están presentes
     * - Maneja casos donde no hay bonos (retorna null)
     * - Formatea los valores monetarios con 2 decimales
     * - Construye estructura de array requerida por la API de nómina
     * 
     * @param {Object} row - Fila de datos del Excel con información de bonos del empleado
     * @param {number|string} [row.otros_devengos_salariales] - Valor del bono salarial (opcional)
     * @param {number|string} [row.otros_devengos_no_salariales] - Valor del bono no salarial (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Array<Object>|null|Array
     * }} Objeto con resultado de la operación
     * 
     */
    generate_accrued_bonuses_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de los bonos', data: [] };

        //Verifico si hay bonos salariales o no salariales
        if (!row.otros_devengos_no_salariales && !row.otros_devengos_salariales) return { error: false, message: 'No hay bonos salariales o no salariales', data: null };

        //Extraigo la informacion de los bonos
        const salary_bonus = Number(row.otros_devengos_salariales);
        const non_salary_bonus = Number(row.otros_devengos_no_salariales);

        //Verifico que los campos sean validos
        if (row.otros_devengos_salariales && isNaN(salary_bonus)) return { error: true, message: 'El campo otros_devengos_salariales debe ser un número válido', data: [] };
        if (row.otros_devengos_no_salariales && isNaN(non_salary_bonus)) return { error: true, message: 'El campo otros_devengos_no_salariales debe ser un número válido', data: [] };

        //Construyo el objeto de bonos
        const bonuses = {};
        if (row.otros_devengos_salariales) bonuses.salary_bonus = salary_bonus.toFixed(2);
        if (row.otros_devengos_no_salariales) bonuses.non_salary_bonus = non_salary_bonus.toFixed(2);

        return { error: false, message: 'Objeto bonos generado correctamente', data: bonuses };
    },

    /**
     * Genera un objeto de vacaciones comunes disfrutadas para devengados de nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de vacaciones comunes del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de devengados
     * en nóminas electrónicas según normativa DIAN colombiana.
     * 
     * Funcionalidad Principal:
     * - Extrae información de días de vacaciones, pago y fechas de disfrute
     * - Valida que las fechas sean coherentes (fecha de regreso >= fecha de salida)
     * - Convierte fechas Excel a formato JavaScript estándar
     * - Formatea valores monetarios con 2 decimales
     * - Maneja casos donde no hay vacaciones (retorna null)
     * - Construye estructura de array anidado requerida por la API de nómina electrónica
     * 
     * @param {Object} row - Fila de datos del Excel con información de vacaciones del empleado
     * @param {number|string} [row.vacaciones_dias] - Número de días de vacaciones disfrutadas (opcional)
     * @param {number|string} [row.vacaciones_disfrutadas] - Valor pagado por las vacaciones disfrutadas (opcional)
     * @param {number|Date|string} [row.vacaciones_salida] - Fecha de inicio de vacaciones en formato Excel (opcional)
     * @param {number|Date|string} [row.vacaciones_ingreso] - Fecha de regreso de vacaciones en formato Excel (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Array<Array<Object>>|null|Array
     * }} 
     * 
     */
    generate_accrued_common_vacation_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las vacaciones', data: [] };

        //Verifico si hay vacaciones comunes
        if (!row.vacaciones_dias) return { error: false, message: 'No hay vacaciones comunes', data: null };

        //Extraigo la informacion de las vacaciones comunes
        const vacation_days = Number(String(row.vacaciones_dias));
        const vacation_payment = Number(String(row.vacaciones_disfrutadas));
        const start_date = new Date(excelDateToJSDate(row.vacaciones_salida));
        const end_date = new Date(excelDateToJSDate(row.vacaciones_ingreso));

        //Verifico que los campos sean validos
        if (isNaN(vacation_days) || vacation_days <= 0) return { error: true, message: 'El campo vacaciones_dias debe ser un número válido', data: [] };
        if (isNaN(vacation_payment) || vacation_payment <= 0) return { error: true, message: 'El campo vacaciones_disfrutadas debe ser un número válido', data: [] };
        if (!row.vacaciones_salida || !util_date.canBeParsedAsDate(row.vacaciones_salida)) return { error: true, message: 'El campo vacaciones_salida debe ser una fecha válida', data: [] };
        if (!row.vacaciones_ingreso || !util_date.canBeParsedAsDate(row.vacaciones_ingreso)) return { error: true, message: 'El campo vacaciones_ingreso debe ser una fecha válida', data: [] };
        if (end_date < start_date) return { error: true, message: 'El campo vacaciones_ingreso debe ser una fecha mayor o igual a vacaciones_salida', data: [] };

        //Construyo el objeto de vacaciones comunes
        const common_vacation = {
            quantity: vacation_days,
            payment: vacation_payment.toFixed(2),
            start_date: start_date.toISOString().split('T')[0],
            end_date: end_date.toISOString().split('T')[0]
        };

        return { error: false, message: 'Objeto vacaciones comunes generado correctamente', data: common_vacation };
    },

    /**
     * Genera un objeto de fechas de pago (payment dates) para nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida las fechas de pago del empleado desde una fila del archivo Excel,
     * construyendo un objeto que cumple con la estructura requerida para el reporte de fechas
     * de pago en nóminas electrónicas según normativa DIAN colombiana y regulaciones laborales.
     * 
     * 
     * @param {Object} row - Fila de datos del Excel con información de fechas de pago del empleado
     * @param {number|Date|string} [row.fecha_pago1] - Primera fecha de pago en formato Excel (opcional)
     * @param {number|Date|string} [row.fecha_pago2] - Segunda fecha de pago en formato Excel (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Array<{payment_date: string}>|Array
     * }} Objeto con resultado de la operación
     * 
     * @returns {Array<{payment_date: string}>} data - Array de fechas de pago cuando es exitoso
     * @returns {string} data[].payment_date - Fecha de pago en formato ISO 8601 (YYYY-MM-DD)
     * 
     */
    generate_payrolls_payments_dates_object(row) {
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las fechas de pago', data: [] };

        //Extraigo la informacion de las fechas de pago
        const payment_dates = [];

        const fecha_pago1 = excelDateToJSDate(row.fecha_pago1);
        const fecha_pago2 = excelDateToJSDate(row.fecha_pago2);

        //Verifico que al menos una fecha de pago este definida
        if (!fecha_pago1 && !fecha_pago2) return { error: true, message: 'Al menos una fecha de pago debe estar definida', data: [] };
        if (!util_date.canBeParsedAsDate(row.fecha_pago1) && !util_date.canBeParsedAsDate(row.fecha_pago2)) return { error: true, message: 'Ambas fechas de pago son invalidas', data: [] };

        //Construyo el objeto de fechas de pago
        if (fecha_pago1) payment_dates.push({ payment_date: fecha_pago1 });
        if (fecha_pago2) payment_dates.push({ payment_date: fecha_pago2 });

        //Retorno el objeto de fechas de pago
        return { error: false, message: 'Objeto fechas de pago generado correctamente', data: payment_dates };
    },

    /**
     * Genera un objeto de deducciones (deductions) para nómina a partir de los datos de una fila de Excel.
     * 
     * Procesa y valida la información de deducciones obligatorias y adicionales del empleado desde 
     * una fila del archivo Excel, construyendo un objeto que cumple con la estructura requerida 
     * para el reporte de deducciones en nóminas electrónicas según normativa DIAN colombiana 
     * y el Sistema de Seguridad Social Integral.
     * 
     * @param {Object} row - Fila de datos del Excel con información de deducciones del empleado
     * @param {boolean} [row.salud_empresa] - Indica si EPS está contratada por empresa (true) o es individual (false)
     * @param {number|string} row.aportes_salud - Valor del aporte a salud/EPS del empleado (4% salario base)
     * @param {number|string} row.aportes_pension - Valor del aporte a pensión del empleado (4% salario base)
     * @param {number|string} row.total_deducciones - Total de todas las deducciones del empleado (obligatorio)
     * @param {number|string} [row.fsp] - Valor del aporte al Fondo de Solidaridad Pensional (opcional, >4 SMMLV)
     * @param {number|string} [row.retencion_fuente] - Valor de retención en la fuente sobre salarios (opcional)
     * @param {number|string} [row.otras_deducciones] - Otras deducciones (sindicatos, cooperativas, préstamos, etc.) (opcional)
     * 
     * @returns {{
     *   error: boolean,
     *   message: string,
     *   data: Object|Array
     * }} 
     */
    generate_payroll_deductions_object(row){
        //Verifico que la fila no este vacia
        if (row == null || row == 0) return { error: true, message: 'No se ha enviado la informacion de las deducciones', data: [] };

        //Extraigo la informacion de las deducciones
        const eps_type_law_deductions_id = row.salud_empresa ? 1 : 3;
        const pension_type_law_deductions_id = 5;
        const eps_deduction = (row.aportes_salud).toFixed(2);
        const pension_deduction = ((row.aportes_pension).toFixed(2));
        const deductions_total = (row.total_deducciones).toFixed(2);

        //Verifico que los campos obligatorios esten completos
        if (!deductions_total || isNaN(deductions_total)) return { error: true, message: 'El campo total_deducciones es obligatorio y debe ser un número válido', data: [] };

        //Construyo el objeto de deducciones
        const deductions = {};
        deductions.eps_type_law_deductions_id = eps_type_law_deductions_id;
        deductions.pension_type_law_deductions_id = pension_type_law_deductions_id;
        deductions.eps_deduction = eps_deduction;
        deductions.pension_deduction = pension_deduction;
        deductions.deductions_total = deductions_total;
        if (row.fsp){
            deductions.fondosp_deduction_SP = ((row.fsp).toFixed(2));
            deductions.fondosp_type_law_deductions_id = 9;
        }

        if (row.retencion_fuente) deductions.withholding_at_source = ((row.retencion_fuente).toFixed(2))
        if (row.otras_deducciones) deductions.other_deductions = [{ other_deduction: (Math.floor(row.otras_deducciones * 100) / 100) }]

        return { error: false, message: 'Objeto deducciones generado correctamente', data: deductions };
    },

    /**
     * Lee un archivo Excel (.xlsx) de nómina y genera un arreglo de objetos `payroll`
     * listos para reportar (no persiste nada).
     *
     * Flujo resumido:
     *  - Lee el buffer del fichero (objeto multer: file.buffer) con `xlsx`.
     *  - Busca la hoja de nombre "Nomina" (búsqueda case-insensitive mediante `.toLowerCase().trim()`).
     *  - Lee las filas del rango fijo (fila 8 en adelante, columnas hasta índice 83) y mapea columnas
     *    según las claves definidas en `payrollStruct`.
     *  - Extrae fechas del periodo desde el encabezado (c:13, filas r:1..3) y convierte valores Excel => JS con `excelDateToJSDate`.
     *  - Recorre cada fila válida, valida campos (vacaciones, incapacidades, cesantías, dotación, fechas de pago, etc.)
     *    y construye objetos: worker, payment, accrued, deductions, payment_dates, period, etc.
     *  - Calcula detalles de horas extra llamando a `extraTimeHours` y marca días ocupados con `arregloDiasOcupados`.
     *
     * Comportamiento de errores:
     *  - Si la hoja "Nomina" no se encuentra devuelve { statusCode: 400, message, data: [] }.
     *  - Validaciones por fila no abortan: se agregan objetos `{ error: 'mensaje' }` al array `response`.
     *  - En errores internos devuelve { statusCode: 500, success: false, error: true, message, data: [] }.
     *
     * @async
     * @param {Object} file
     *        Objeto multer con el Excel subido.
     * @param {Buffer} file.buffer
     *        Buffer del .xlsx (requerido).
     * @param {string} [file.originalname]
     *        Nombre original del archivo (opcional, útil para logging).
     *
     * @returns {Promise<
     *   { statusCode: number, message: string, data: Array<Object> } |
     *   { statusCode: 400, message: string, data: [] } |
     *   { statusCode: 500, success: false, error: true, message: string, data: [] }
     * >}
     *
     * Estructura y requisitos del Excel esperado:
     *  - Hoja con nombre "Nomina" (se busca insensitivo a mayúsculas/espacios).
     *  - Datos de empleados empiezan en la fila 8 (0-based r:7).
     *  - Se lee hasta la columna índice 83.
     *  - Periodo en c:13 filas r:1..3 (issue_date, settlement_start_date, settlement_end_date).
     *  - Columnas mapeadas según `Object.keys(payrollStruct)`.
     *
     * Notas / recomendaciones:
     *  - El método normaliza números y fechas con `Number(...)` y `excelDateToJSDate`.
     *  - Puede devolver mezcla de payrolls válidos y objetos de error en `data`.
     *  - Mejora recomendada: permitir búsqueda de hoja tolerante a acentos y validar extensión/signature del buffer.
     *
     * Ejemplo:
     *  const res = await payrollService.generate_json_excel_payroll(req.file);
     *  if (res.statusCode === 200) { console.log(res.data); } else { console.error(res.message); }
     */
    async generate_json_excel_payroll(file) {
        try {
            if (!file) return { statusCode: 400, message: 'Archivo Excel es requerido', data: [] };
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });

            //obtengo la hoja Nomina
            const idSheet = workbook.SheetNames.map(name => name.toLowerCase().trim()).indexOf('nomina');
            const sheetName = workbook.SheetNames[idSheet];

            if (!sheetName) return { statusCode: 400, message: `Hoja Nomina no encontrada`, data: [] };
            const ws = workbook.Sheets[sheetName];

            // Procesar cada hoja del libro

            //defino el rango de la A a la BN
            const ref = XLSX.utils.decode_range(ws['!ref']);
            // {s:{r,c}, e:{r,c}}
            const start = { r: 7, c: 0 };   //r:(row inicial del archivo),c (A = col 0 del archivo)
            const end = { r: ref.e.r, c: 94 };     // r = ultima row activa, CB = (col 90 (0-based) del archivo)

            const rangeStr = XLSX.utils.encode_range(start, end);

            //obtengo las claves del objeto de la estructura de la nomina para usarlas como nombre de las columnas
            const KEYS = Object.keys(payrollStruct);

            // Obtiene matriz de filas (arrays), dentro del rango definido
            const rows = XLSX.utils.sheet_to_json(ws, {
                header: KEYS,
                range: rangeStr,
                raw: true,
                blankrows: false, // ya omite filas 100% vacías
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

                //genero el objeto trabajador (Worker)
                let worker = this.generate_payroll_worker_object(row);
                if (worker.error) {
                    response.push({ error: `Error en la fila del empleado ${row.primer_nombre} ${row.primer_apellido}: ${worker.message}`, message: worker.message });
                    continue;
                }
                worker = worker.data;

                //Genero el objeto del pago (Payment)
                let payment = this.generate_payroll_payment_object(row);
                if (payment.error) {
                    response.push({ error: `Error en la fila del empleado ${row.primer_nombre} ${row.primer_apellido}: ${payment.message}`, message: payment.message });
                    continue;
                }
                payment = payment.data;

                //Genero el objeto de devengados (Accrued)
                let accrued = this.generate_payroll_accrued_object(row);
                if (accrued.error) {
                    response.push({ error: `Error en la fila del empleado ${row.primer_nombre} ${row.primer_apellido}: ${accrued.message}`, message: accrued.message });
                    continue;
                }
                accrued = accrued.data;


                //Genero el objeto de deducciones (Deductions)
                let deductions = this.generate_payroll_deductions_object(row);
                if (deductions.error) {
                    response.push({ error: `Error en la fila del empleado ${row.primer_nombre} ${row.primer_apellido}: ${deductions.message}`, message: deductions.message });
                    continue;
                }
                deductions = deductions.data;

                // Generar las fechas de pago
                let payment_dates = this.generate_payrolls_payments_dates_object(row);
                if (payment_dates.error) {
                    response.push({ error: `Error en la fila del empleado ${row.primer_nombre} ${row.primer_apellido}: ${payment_dates.message}`, message: payment_dates.message });
                    continue;
                }
                payment_dates = payment_dates.data;

                //Dias trabajados y fecha de ingreso
                if (row.Dias_en_la_empresa && isNaN(Number(row.Dias_en_la_empresa))) {
                    response.push({ error: `Error en los dias trabajados para el empleado ${worker.first_name} ${worker.surname}, valor no definido o invalido` });
                    continue;
                }

                period.worked_time = row.Dias_en_la_empresa ? (row.Dias_en_la_empresa).toString() : null;
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
                    worker_code: row.cedula ? (row.cedula).toString() : null,
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


            return { statusCode: 200, message: `Nóminas generadas desde archivo Excel`, data: response };
        } catch (error) {
            console.error('Error al generar el JSON de la nómina desde Excel:', error);
            return { statusCode: 500, success: false, error: true, message: error.message, data: [] };
        }

    },

    /**
     * Procesa un archivo Excel de nómina y reporta las nóminas a NextPyme (Dian).
     *
     * Flujo:
     *  1. Convierte el Excel a JSON llamando a `generate_json_excel_payroll(file)`.
     *  2. Si la conversión es exitosa, envía los payrolls a NextPyme mediante
     *     `nextPymeService.nextPymeService.sendPayrolltoDian`.
     *  3. Devuelve el resultado combinado (datos y errores) reportados por NextPyme.
     *
     * Observaciones:
     *  - Propaga y retorna directamente los objetos de error devueltos por
     *    `generate_json_excel_payroll` o por el servicio NextPyme.
     *  - Realiza llamadas externas (I/O / red) y puede fallar por problemas de conexión.
     *
     * @async
     * @param {Object} file
     *        Objeto multer del archivo subido.
     * @param {Buffer} file.buffer
     *        Buffer del .xlsx (requerido).
     * @param {string} [file.originalname]
     *        Nombre original del archivo (opcional, útil para logs).
     *
     * @returns {Promise<
     *   { statusCode: 200, message: string, data: { data: any, errors: any } } |
     *   { statusCode: number, message: string, data?: any } |
     *   { success: false, error: true, message: string }
     * >}
     *
     * - Éxito: statusCode 200 y `data` contiene { data: <resultados NextPyme>, errors: <errores NextPyme> }.
     * - Si `generate_json_excel_payroll` o NextPyme devuelven un error, la función retorna ese mismo objeto.
     * - En excepción interna retorna { success: false, error: true, message: 'Error interno del servidor' }.
     *
     * @example
     * const res = await payrollService.reportPayrollsByExcel(req.file);
     * if (res.statusCode === 200) {
     *   console.log('Reportado:', res.data.data);
     *   console.log('Errores:', res.data.errors);
     * } else {
     *   console.error('Error:', res.message);
     * }
     */
    async reportPayrollsByExcel(file) {
        try {

            const jsonPayrolls = await this.generate_json_excel_payroll(file);
            if (jsonPayrolls.statusCode !== 200) return jsonPayrolls;
            return { statusCode: 200, message: `Nóminas reportadas desde archivo Excel`, data: jsonPayrolls.data }
            const nextPymeResponse = await nextPymeService.nextPymeService.sendPayrolltoDian(jsonPayrolls.data);
            if (nextPymeResponse.statusCode !== 200) return nextPymeResponse;

            return { statusCode: 200, message: `Nóminas reportadas desde archivo Excel`, data: { data: nextPymeResponse.data, errors: nextPymeResponse.errors }, jsons: jsonPayrolls.data };
        } catch (error) {
            console.error('Error al conectar con Radian:', error);
            return { success: false, error: true, message: 'Error interno del servidor' };
        }
    },


    /**
     * Construye las jornadas de horas extra dentro de un periodo, distribuyendo las horas
     * por día según límites por tipo y calculando rangos de tiempo en UTC.
     *
     * Reglas y comportamiento:
     *  - Recibe conceptos con { type, quantity, payment } donde:
     *      - type: código de la hora extra ('HED','HEN','HRN','HEDDF','HENDF', ...).
     *      - quantity: horas totales a distribuir (string|number).
     *      - payment: valor total a prorratear (string|number).
     *  - Distribuye las horas en "laps" según el máximo por día (por defecto 3h).
     *  - Calcula start_time / end_time en UTC usando rangos por tipo (e.g. HED 18:00-21:00).
     *  - Omite días marcados como ocupados en FechasOcupadas.
     *  - No lanza excepciones: en errores devuelve objeto con { success: false, error: true, message }.
     *
     * @param {Array.<{type: string, quantity: string|number, payment: string|number}>} horasExtrasData
     *        Array de conceptos de horas extra a procesar.
     * @param {string} type
     *        Identificador del grupo esperado ('HEDs','HENs','HRNs','HEDDFs','HENDFs','HRDDFs','HRNDFs', etc.).
     * @param {string|Date} dateFrom
     *        Fecha de inicio del periodo (inclusive). Acepta Date o cadena 'YYYY-MM-DD'.
     * @param {string|Date} dateTo
     *        Fecha fin del periodo (inclusive). (No usado extensamente en la implementación actual
     *        pero incluido por contrato).
     * @param {Array.<Record<string,boolean>>} FechasOcupadas
     *        Arreglo indexado por día del mes con objetos [ {'1': boolean}, {'2': boolean}, ... ] donde
     *        true significa día ocupado (no asignable).
     *
     * @returns {{
     *   statusCode: number,
     *   message: string,
     *   data: Array.<{
     *     start_time: string, // ISO-like sin 'Z' (ej. "2025-10-01T18:00:00")
     *     end_time: string,
     *     quantity: number,
     *     payment: string|number,
     *     percentage?: number
     *   }>
     * } | { success: false, error: true, message: string }}
     *
     * @example
     * const res = payrollService.extraTimeHours(
     *   [{ type: 'HED', quantity: '5', payment: '50000' }],
     *   'HEDs',
     *   '2025-10-01',
     *   '2025-10-31',
     *   [{ '1': false }, { '2': true }, ...]
     * );
     * if (res.statusCode === 200) console.log(res.data);
     */
    extraTimeHours(horasExtrasData, type, dateFrom, dateTo, FechasOcupadas) {
        try {
            if (!horasExtrasData || horasExtrasData.length == 0) {
                return { statusCode: 400, message: `No se proporcionaron datos de horas extras`, data: [] };
            }

            if (type !== 'HRNs' && type !== 'HENs' && type !== 'HRDDFs' && type !== 'HEDs' && type !== 'HEDDFs' && type !== 'HENDFs' && type !== 'HRNDFs') {
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
                'HEDDF': 4,
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
                    //en este arrego [{'1': false},{'2': true},...] el indice [1]['2'] del arreglo indica que ese dia esta ocupado y no se pueden asignar horas extras
                    if (FechasOcupadas[i][String(i + 1)]) continue;

                    //ahora armo la lista de dias con las horas extras
                    //Para asignar necesito saber la fecha de inicio y fin del perido de nomina porque las horas extra vienen sin esa data
                    //para las horas extra entre semana voy a asignar los dias de lunes a sabado

                    //definir los dias y horas para las horas extras
                    const dayInit = new Date(dateFrom);
                    const dayEnd = new Date(dateFrom);

                    dayInit.setUTCHours(rangeHoursExtra[horaExtra.type][0], 0, 0);
                    const hoursToAssign = horasRestantes < Math.ceil(Number(horaExtra.quantity) / laps) ? horasRestantes : Math.ceil(Number(horaExtra.quantity) / laps)
                    dayEnd.setUTCHours(rangeHoursExtra[horaExtra.type][0] + hoursToAssign, 0, 0);
                    const payable_amount = (pay * hoursToAssign).toFixed(2);
                    if (weekDay != 0 && (horaExtra.type == 'HED' || horaExtra.type == 'HEN' || horaExtra.type == 'HRN')) {
                        response.push({
                            start_time: new Date(dayInit.setDate(dayInit.getUTCDay() + i)).toISOString().split('.')[0].replace('Z', ''),
                            end_time: new Date(dayEnd.setDate(dayEnd.getUTCDay() + i)).toISOString().split('.')[0].replace('Z', ''),
                            quantity: hoursToAssign,
                            percentage: pergentage[horaExtra.type],
                            payment: payable_amount,
                        });

                        horasRestantes -= hoursToAssign;

                    } else if (weekDay == 0 && (horaExtra.type == 'HRDDF' || horaExtra.type == 'HEDDF' || horaExtra.type == 'HENDF' || horaExtra.type == 'HRNDF')) {
                        //Domingo
                        response.push({
                            start_time: new Date(dayInit.setDate(dayInit.getUTCDay() + i)).toISOString().split('.')[0].replace('Z', ''),
                            end_time: new Date(dayEnd.setDate(dayEnd.getUTCDay() + i)).toISOString().split('.')[0].replace('Z', ''),
                            quantity: hoursToAssign,
                            payment: payable_amount,
                            percentage: pergentage[horaExtra.type]
                        });
                        horasRestantes -= hoursToAssign;
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
     * // ... mes[3]['4'] === false, mes[4]['5'] === true, mes[5]['6'] === true, mes[6]['7'] === true, mes[7]['8'] === true, ....
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
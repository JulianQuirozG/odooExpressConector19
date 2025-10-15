//Imports odoo connection
const odooConector = require("../utils/odoo.service");

//Imports services
const employeeService = require("../services/employee.service");
const moveService = require("../services/bills.service");
const bankAccountService = require("../services/bankAccount.service");

// Imports repositories
const paramsTypeDocumentIdentificationRepository = require("../Repository/params_type_document_identification.repository/params_type_document_identification.repository");
const paramsMunicipalitiesRepository = require("../Repository/params_municipalities/params_municipalities.repository");
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
            worker.second_name = null;
            worker.first_surname = null;
            worker.second_surname = null;

            if (employeeName.length == 3) {
                worker.first_surname = employeeName[1];
                worker.second_surname = employeeName[2];
            } else {
                worker.first_surname = employeeName[1];
                worker.second_name = employeeName[2];

                worker.second_surname = employeeName[3];
            }

            //Tipo de trabajador

            //Municipio
            if (!employee.data.private_city) return { statusCode: 400, message: 'Error al obtener la nómina', error: 'La ciudad del empleado no está definida', data: [] };
            const municipality_id = (await paramsMunicipalitiesRepository.getMunicipalityByName(employee.data.private_city)).data[0].id;
            if (!municipality_id) return { statusCode: 404, message: "El municipio no está configurado en la tabla de parámetros" };
            worker.municipality_id = municipality_id;

            //Tipo de contrato

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
            worker_code = employee.data.id

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
            const payment_method_id = 47;
            payment.payment_method_id = payment_method_id;

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
            console.log("Fecha de pago de la nomina: ", payroll.data.paid_date);
            const payment_date = new Date(payroll.data.paid_date);
            console.log("Fecha de pago de la nomina: ", payment_date);
            // Obtener el último día del mes:
            const endOfMonth = new Date(payment_date.getFullYear(), payment_date.getMonth() + 1, 0);
            payment_dates.payment_date = [endOfMonth.toISOString().split('T')[0]];

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
            let accrued = {};

            //Fecha del pago
            accrued.payment_date = endOfMonth.toISOString().split('T')[0];

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
            return { statusCode: 500, success: false, error: true, message: 'Error interno del servidor' };
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
            if (payroll.data.length === 0) return { statusCode: 404, message: 'Nómina no encontrada' };

            //Me recorro las nominas y les agrego las lineas de la nomina
            payroll.data = await Promise.all(payroll.data.map(async (payslip) => {
                const lines = await odooConector.executeOdooRequest("hr.payslip.line", "search_read", { domain: [["slip_id", "=", payslip.id]] });
                if (lines.error) return { statusCode: 500, message: 'Error al obtener las líneas de la nómina', error: lines.message };
                if (!lines.success) return { statusCode: 400, message: 'Error al obtener las líneas de la nómina', data: lines.data };
                payslip.line_ids = lines.data;
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
            console.log("PAYROLL: ", payrollId);
            //Recupero los asientos contables de la nomina
            const response = await odooConector.executeOdooRequest("hr.payslip", "action_open_move", { ids: [Number(payrollId)] });
            if (response.error) return { statusCode: 500, message: 'Error al obtener los asientos contables de la nómina', error: response.message };
            if (!response.success) return { statusCode: 400, message: 'Error al obtener los asientos contables de la nómina', data: response.data };
            console.log("RESPONSE: ", response);
            let moves = response.data.res_id == 0 ? response.data.domain[0][2] : [response.data.res_id];
            console.log("MOVES IDS: ", moves);
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
}

module.exports = payrollService;
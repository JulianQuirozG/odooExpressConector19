//Imports odoo connection
const odooConector = require("../utils/odoo.service");

//Imports services
const partnerService = require("../services/partner.service");

const employeeService = {
    /**
     * Obtiene un empleado por su ID desde Odoo (hr.employee).
     *
     * @async
     * @param {number|string} id - ID del empleado (numérico o convertible a número positivo).
     * @returns {Promise<{statusCode:number, message:string, data:any, error?:any}>}
     *  - 200: data contiene el registro del empleado.
     *  - 400: ID inválido o error de solicitud.
     *  - 404: empleado no encontrado.
     *  - 500: error interno al consultar Odoo.
     * @example
     * const res = await employeeService.getEmployeeById(12);
     * if (res.statusCode === 200) console.log(res.data.name);
     */
    async getEmployeeById(id) {
        try {
            //Verifico que el id sea valido
            if (Number(id) <= 0 || isNaN(Number(id))) return { statusCode: 400, message: `ID de empleado '${id}' inválido, debe ser un número positivo`, data: [] };

            //Recupero la informacion del empleado
            const employee = await odooConector.executeOdooRequest("hr.employee", "search_read", { domain: [["id", "=", id]], limit: 1 });
            if (employee.error) return { statusCode: 500, message: 'Error al obtener al empleado', error: employee.message, data: [] };
            if (!employee.success) return { statusCode: 400, message: 'Error al obtener al empleado', data: employee.data };
            if (employee.data.length === 0) return { statusCode: 404, message: 'Empleado no encontrado', data: [] };

            //Regreso la informacion del empleado
            return { statusCode: 200, message: 'Detalle del empleado', data: employee.data[0] };
        } catch (error) {
            console.error('Error al obtener el empleado por id:', error);
            return { statusCode: 500, success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    },
    /**
     * Obtiene los contactos relacionados a un empleado (action_related_contacts).
     *
     * @async
     * @param {number|string} id - ID del empleado.
     * @returns {Promise<{statusCode:number, message:string, data:any[], error?:any}>}
     *  - 200: data con la lista de contactos (res.partner) del empleado.
     *  - 400/404: validaciones fallidas o empleado no encontrado.
     *  - 500: error interno al consultar Odoo.
     * @example
     * const res = await employeeService.getContactsByEmployeeId(12);
     * if (res.statusCode === 200) console.log(res.data.length);
     */
    async getContactsByEmployeeId(id) {
        try {
            //Verifico que el id sea valido
            if (Number(id) <= 0 || isNaN(Number(id))) return { statusCode: 400, message: `ID de empleado '${id}' inválido, debe ser un número positivo`, data: [] };

            //Verifico que el empleado exista
            const employee = await this.getEmployeeById(id);
            if (employee.statusCode !== 200) return employee;

            //Recupero los contactos del empleado
            const response = await odooConector.executeOdooRequest("hr.employee", "action_related_contacts", { ids: [id] });
            let contacts = response.data.res_id == 0 ? response.data.domain[0][2] : [response.data.res_id];

            //Recupero la informacion de los contactos
            contacts = await Promise.all(contacts.map(async (contactId) => {
                const contact = await partnerService.getOnePartner(contactId);
                return contact.data;
            }));

            //Regreso la informacion de los contactos
            return { statusCode: 200, message: 'Lista de contactos del empleado', data: contacts };
        } catch (error) {
            console.error('Error al obtener el empleado por id:', error);
            return { statusCode: 500, success: false, error: true, message: 'Error interno del servidor', data: [] };
        }
    }

}



module.exports = employeeService;
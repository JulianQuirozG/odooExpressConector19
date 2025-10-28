const { canBeParsedAsDate } = require("./date");

const util_validate = {
    validateObject(obj, object_name = '') {
        try {
            //Verifico que los campos obligatorios del objeto estén presentes y no sean nulos o vacíos
            for (const [keyof, value] of Object.entries(obj)) {
                if (value == null)  return { success: false, error: false, message: `El campo ${keyof} del ${object_name} es obligatorio.`, data: [] };
                if (typeof value == 'number' && (isNaN(value) || value <= 0)) return { success: false, error: false, message: `El campo ${keyof} del ${object_name} debe ser un número válido.`, data: [] };
                if (value instanceof Date && !canBeParsedAsDate(value)) return { success: false, error: false, message: `El campo ${keyof} del ${object_name} debe ser una fecha válida.`, data: [] };
            }

            // Si todas las validaciones pasan, retorno el objeto validado
            return { success: true, error: false, message: 'Validación exitosa del objeto.', data: obj };
        } catch (error) {
            console.error('Error en validateObject:', error);
            return { success: false, error: true, message: 'Error interno del servidor durante la validación del objeto.', data: [] };
        }
    }
}

module.exports = util_validate
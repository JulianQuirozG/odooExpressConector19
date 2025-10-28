const { canBeParsedAsDate } = require("./date");

const util_validate = {

    /**
     * Valida las propiedades de un objeto de primer nivel.
     *
     * Comprobaciones realizadas:
     *  - Ningún campo puede ser null o undefined.
     *  - Los valores numéricos deben ser números válidos y mayores a 0.
     *  - Las instancias Date deben ser parseables (usa canBeParsedAsDate).
     *
     * Limitaciones:
     *  - La validación no es recursiva: solo valida propiedades de primer nivel.
     *  - No valida esquemas complejos ni tipos compuestos (arrays/objetos anidados).
     *
     * @param {Object} obj - Objeto a validar. Sus propiedades se consideran obligatorias.
     * @param {string} [object_name=''] - Nombre descriptivo del objeto (se usa en mensajes de error).
     *
     * @returns {{ success: boolean, error: boolean, message: string, data: Object|Array }}
     */
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
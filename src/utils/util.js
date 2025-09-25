/**
 * Devuelve un nuevo objeto solo con los campos especificados.
 * @function pickFields
 * @param {Object} obj - Objeto de origen.
 * @param {Array<string>} fields - Lista de campos a extraer.
 * @returns {Object} Nuevo objeto con los campos seleccionados.
 */
function pickFields(obj, fields) {
    return fields.reduce((acc, field) => {
        if (obj[field] !== undefined) acc[field] = obj[field];
        return acc;
    }, {});
}

module.exports = { pickFields };
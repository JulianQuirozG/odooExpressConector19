const dbConnect = require("../../config/db");

exports.createUnitMeasure = async (id, name, code) => {
    try {
        const query = "INSERT INTO param_unit_measures (id, name, code) VALUES (?, ?, ?)";
        const params = [id, name, code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al crear la unidad de medida:", error);
        return {
            statusCode: 500,
            message: "Error al crear la unidad de medida.",
            error: error.message,
        };
    }
}

exports.getUnitMeasureByCode = async (code) => {
    try {
        const query = "SELECT * FROM param_unit_measures WHERE code = ?";
        const params = [String(code ?? '').trim()];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al obtener la unidad de medida por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener la unidad de medida por código.",
            error: error.message,
        };
    }
}

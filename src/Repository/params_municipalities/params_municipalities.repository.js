const dbConnect = require("../../config/db");

exports.createMunicipalities = async (id, department_id, name, code) => {
    try {
        const query = "INSERT INTO param_municipalities (id, department_id, name, code) VALUES (?, ?, ?, ?)";
        const params = [id, department_id, name, code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al crear el municipio:", error);
        return {
            statusCode: 500,
            message: "Error al crear el municipio.",
            error: error.message,
        };
    }
}

exports.getMunicipalityByCode = async (code) => {
    try {
        const query = "SELECT * FROM param_municipalities WHERE code = ?";
        const params = [code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al obtener el municipio por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el municipio por código.",
            error: error.message,
        };
    }
}

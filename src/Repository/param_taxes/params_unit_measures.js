const dbConnect = require("../../config/db");

exports.createTax = async (id, name, code) => {
    try {
        const query = "INSERT INTO param_taxes (id, name, code) VALUES (?, ?, ?)";
        const params = [id, name, code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al crear el impuesto:", error);
        return {
            statusCode: 500,
            message: "Error al crear el impuesto.",
            error: error.message,
        };
    }
}

exports.getTaxByCode = async (code) => {
    try {
        const query = "SELECT * FROM param_taxes WHERE code = ?";
        const params = [String(code ?? '').trim()];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al obtener el impuesto por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el impuesto por código.",
            error: error.message,
        };
    }
}

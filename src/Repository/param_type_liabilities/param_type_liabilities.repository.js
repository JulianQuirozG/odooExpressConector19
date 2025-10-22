const dbConnect = require("../../config/db");

exports.getTypeLiabilitiesByCode = async (code) => {
    try {
        const query = "SELECT * FROM param_type_liabilities WHERE code = ?";
        const params = [String(code ?? '').trim()];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al obtener el impuesto por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el tipo de obligación por código.",
            error: error.message,
        };
    }
}
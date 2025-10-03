const dbConnect = require("../../config/db");

exports.getTypeDocumentByCode = async (code) => {
    try {
        const query = "SELECT * FROM param_type_document_identification WHERE odoo_code = ?";
        const params = [code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al obtener el tipo de documento por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el tipo de documento por código.",
            error: error.message,
        };
    }
}


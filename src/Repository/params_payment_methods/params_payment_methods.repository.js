const dbConnect = require("../../config/db");

exports.createPayment_methods = async (id, name, code) => {
    try {
        const query = "INSERT INTO param_payment_methods (id, name, code) VALUES (?, ?, ?)";
        const params = [id, name, code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al crear el método de pago:", error);
        return {
            statusCode: 500,
            message: "Error al crear el método de pago.",
            error: error.message,
        };
    }
}

exports.getPaymentMethodByCode = async (code) => {
    try {
        const query = "SELECT * FROM param_payment_methods WHERE code = ?";
        if(code != 'ZZZ') code = Number(code);
        const params = [code];
        const result = await dbConnect.executeQuery(query, params);
        return result;
    } catch (error) {
        console.error("Error al obtener el método de pago por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el método de pago por código.",
            error: error.message,
        };
    }
}

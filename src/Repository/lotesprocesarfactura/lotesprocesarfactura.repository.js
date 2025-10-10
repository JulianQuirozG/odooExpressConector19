const dbConnect = require("../../config/db");

const states = {
    PENDING: '0',
    PROCESSING: '1',
    DONE: '2',
    ERROR: '3'
};


exports.createBillRecord = async (id) => {
    try {
        const name = states.PROCESSING;
        const query = "INSERT INTO lotesprocesarfactura (idexterno, inicia_proceso, expira_proceso, estado) VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 5 MINUTE), ?)";
        const params = [id, name];
        const result = await dbConnect.executeQuery(query, params);
        if (result.error) {
            return { statusCode: 500, message: "Error al crear el registro de factura", error: result.error };
        }
        return { statusCode: 201, message: "Registro de factura creado", data: result.data };
    } catch (error) {
        console.error("Error al crear el registro de factura:", error);
        return {
            statusCode: 500,
            message: "Error al crear el registro de factura",
            error: error.message,
        };
    }
}

exports.getIdsBill = async (code) => {
    try {
        const query = "SELECT * FROM lotesprocesarfactura WHERE idexterno = ?";
        const params = [String(code ?? '').trim()];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data || [] };
    } catch (error) {
        console.error("Error al obtener el registro de factura por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el registro de factura por código.",
            error: error.message,
        };
    }
}

exports.getBillsStay = async () => {
    try {
        const query = `SELECT idexterno FROM lotesprocesarfactura WHERE estado = ? AND (
        estado IN ('1','3')
        OR (estado='processing' AND expira_proceso < NOW())
        )`;
        const params = [states.PROCESSING];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data || [] };
    } catch (error) {
        console.error("Error al obtener el registro de factura por estado:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el registro de factura por estado.",
            error: error.message,
        };
    }
}

exports.claimBillRecord = async (id, name = states.PROCESSING) => {
    try {
        const query = `UPDATE lotesprocesarfactura SET estado = ?, inicia_proceso=NOW(), expira_proceso=DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE idexterno = ?`;
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de factura:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de factura",
            error: error.message,
        };
    }
}


exports.CompleteBillRecord = async (id, name = states.DONE) => {
    try {
        const query = "UPDATE lotesprocesarfactura SET estado = ? WHERE idexterno = ?";
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 201, message: "Registro de factura actualizado", data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de factura:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de factura",
            error: error.message,
        };
    }
}

exports.ErrorBillRecord = async (id, name = states.ERROR) => {
    try {
        const query = "UPDATE lotesprocesarfactura SET estado = ? WHERE idexterno = ?";
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, message: "Registro de factura actualizado", data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de factura:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de factura",
            error: error.message,
        };
    }
}



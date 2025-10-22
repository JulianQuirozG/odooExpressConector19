const dbConnect = require("../../config/db");

const states = {
    PENDING: '0',
    PROCESSING: '1',
    DONE: '2',
    ERROR: '3'
};


exports.createCreditNoteRecord = async (id) => {
    try {
        const name = states.PROCESSING;
        const query = "INSERT INTO lotesprocesarnotacredito (idexterno, inicia_proceso, expira_proceso, estado) VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 5 MINUTE), ?)";
        const params = [id, name];
        const result = await dbConnect.executeQuery(query, params);
        if (result.error) {
            return { statusCode: 500, message: "Error al crear el registro de nota de crédito", error: result.error };
        }
        return { statusCode: 201, message: "Registro de nota de crédito creado", data: result.data };
    } catch (error) {
        console.error("Error al crear el registro de nota de crédito:", error);
        return {
            statusCode: 500,
            message: "Error al crear el registro de nota de crédito",
            error: error.message,
        };
    }
}

exports.getIdsCreditNote = async (code) => {
    try {
        const query = "SELECT * FROM lotesprocesarnotacredito WHERE idexterno = ?";
        const params = [String(code ?? '').trim()];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data || [] };
    } catch (error) {
        console.error("Error al obtener el registro de nota de crédito por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el registro de nota de crédito por código.",
            error: error.message,
        };
    }
}

exports.getCreditNotesStay = async () => {
    try {
        const query = `SELECT idexterno FROM lotesprocesarnotacredito WHERE estado = ? AND (
        estado IN ('1','3')
        OR (estado='processing' AND expira_proceso < NOW())
        )`;
        const params = [states.PROCESSING];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data || [] };
    } catch (error) {
        console.error("Error al obtener el registro de nota de crédito por estado:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el registro de nota de crédito por estado.",
            error: error.message,
        };
    }
}

exports.claimCreditNoteRecord = async (id, name = states.PROCESSING) => {
    try {
        const query = `UPDATE lotesprocesarnotacredito SET estado = ?, inicia_proceso=NOW(), expira_proceso=DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE idexterno = ?`;
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de nota de crédito:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de nota de crédito",
            error: error.message,
        };
    }
}


exports.CompleteCreditNoteRecord = async (id, name = states.DONE) => {
    try {
        const query = "UPDATE lotesprocesarnotacredito SET estado = ? WHERE idexterno = ?";
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 201, message: "Registro de nota de crédito actualizado", data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de nota de crédito:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de nota de crédito",
            error: error.message,
        };
    }
}

exports.ErrorCreditNoteRecord = async (id, name = states.ERROR) => {
    try {
        const query = "UPDATE lotesprocesarnotacredito SET estado = ? WHERE idexterno = ?";
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, message: "Registro de nota de crédito actualizado", data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de nota de crédito:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de nota de crédito",
            error: error.message,
        };
    }
}



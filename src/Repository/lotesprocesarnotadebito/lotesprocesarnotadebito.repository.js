const dbConnect = require("../../config/db");

const states = {
    PENDING: '0',
    PROCESSING: '1',
    DONE: '2',
    ERROR: '3'
};


exports.createDebitNoteRecord = async (id) => {
    try {
        const name = states.PROCESSING;
        const query = "INSERT INTO lotesprocesarnotadebito (idexterno, inicia_proceso, expira_proceso, estado) VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 5 MINUTE), ?)";
        const params = [id, name];
        const result = await dbConnect.executeQuery(query, params);
        if (result.error) {
            return { statusCode: 500, message: "Error al crear el registro de nota de débito", error: result.error };
        }
        return { statusCode: 201, message: "Registro de nota de débito creado", data: result.data };
    } catch (error) {
        console.error("Error al crear el registro de nota de débito:", error);
        return {
            statusCode: 500,
            message: "Error al crear el registro de nota de débito",
            error: error.message,
        };
    }
}

exports.getIdsDebitNote = async (code) => {
    try {
        const query = "SELECT * FROM lotesprocesarnotadebito WHERE idexterno = ?";
        const params = [String(code ?? '').trim()];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data || [] };
    } catch (error) {
        console.error("Error al obtener el registro de nota de débito por código:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el registro de nota de débito por código.",
            error: error.message,
        };
    }
}

exports.getDebitNotesStay = async () => {
    try {
        const query = `SELECT idexterno FROM lotesprocesarnotadebito WHERE estado = ? AND (
        estado IN ('1','3')
        OR (estado='processing' AND expira_proceso < NOW())
        )`;
        const params = [states.PROCESSING];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data || [] };
    } catch (error) {
        console.error("Error al obtener el registro de nota de débito por estado:", error);
        return {
            statusCode: 500,
            message: "Error al obtener el registro de nota de débito por estado.",
            error: error.message,
        };
    }
}

exports.claimDebitNoteRecord = async (id, name = states.PROCESSING) => {
    try {
        const query = `UPDATE lotesprocesarnotadebito SET estado = ?, inicia_proceso=NOW(), expira_proceso=DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE idexterno = ?`;
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de nota de débito:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de nota de débito",
            error: error.message,
        };
    }
}


exports.CompleteDebitNoteRecord = async (id, name = states.DONE) => {
    try {
        const query = "UPDATE lotesprocesarnotadebito SET estado = ? WHERE idexterno = ?";
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 201, message: "Registro de nota de débito actualizado", data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de nota de débito:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de nota de débito",
            error: error.message,
        };
    }
}

exports.ErrorDebitNoteRecord = async (id, name = states.ERROR) => {
    try {
        const query = "UPDATE lotesprocesarnotadebito SET estado = ? WHERE idexterno = ?";
        const params = [name, id];
        const result = await dbConnect.executeQuery(query, params);
        return { statusCode: 200, message: "Registro de nota de débito actualizado", data: result.data };
    } catch (error) {
        console.error("Error al actualizar el registro de nota de débito:", error);
        return {
            statusCode: 500,
            message: "Error al actualizar el registro de nota de débito",
            error: error.message,
        };
    }
}



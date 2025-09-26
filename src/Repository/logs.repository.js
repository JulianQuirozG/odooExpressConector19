const DbConfig = require('../config/db.js')


const LogsRepository = {

    async insertLog(service = 'object',
        method = 'execute_kw', args, result = '') {
        const query = `INSERT INTO odoo_request_logs (service, method, args, response) VALUES (?, ?, ?, ?)`;
        const params = [service, method, JSON.stringify(args), JSON.stringify(result)];
        // Obtengo la conexion
        const connectionData = await DbConfig.getConnection();

        if (!connectionData.success) {
            console.error('Error getting DB connection for log insertion:', connectionData.message);
            return { success: false, message: connectionData.message, data: [] };
        }
        try {
            await connectionData.data.beginTransaction();
            await connectionData.data.execute(query, params);
            await connectionData.data.commit();
            return { success: true, message: 'Log inserted successfully' };
        } catch (error) {
            console.error('Error inserting log:', error);
            await connectionData.data.rollback();
            return { success: false, message: 'Error inserting log' };
        } finally {
            console.log("Releasing DB connection after log insertion");
            await connectionData.data.release();
        }

    }
}
module.exports = { LogsRepository };
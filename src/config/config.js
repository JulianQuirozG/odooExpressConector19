require('dotenv').config();
module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Configuración de Odoo
    odooUrl: process.env.ODOO_URL || 'http://localhost:8069/json/2',
    odooDb: process.env.ODOO_DB || '',
    odooUsername: process.env.ODOO_USERNAME || '',
    odooPassword: process.env.ODOO_PASSWORD || '',
    odooApiKey: process.env.ODOO_API_KEY || '',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key',
    jwtExpiresIn: '24h',

    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456789',
        database: process.env.DB_NAME || 'odoo_params',
        port: process.env.DB_PORT || 3306,
        connectionLimit: 10

    }

};
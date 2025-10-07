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
        user: process.env.DB_USER || 'Julian',
        password: process.env.DB_PASSWORD || 'ypvu-j8xj-puqy',
        database: process.env.DB_NAME || 'odoo_params',
        port: process.env.DB_PORT || 3306,
        connectionLimit: 10

    },
    nextPyme:
    {
        nit: process.env.NIT_EMPRESA || '900373553',
        apiKey: process.env.NEXTPYME_API_KEY || '0cc6c1bd3fa3bee382ff291379e86cb470b52a00d9c99e89c8ef5ae882dc559c',
        apiUrl: process.env.NEXTPYME_API_URL || 'https://api.nextpyme.com/v1'
    }

};
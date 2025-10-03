require('dotenv').config();
const express = require('express');


// Importar configuraciones y middleware
const config = require('./config/config');

// Importar rutas
const partnerRoutes = require('./routes/partner.routes');
const bankRoutes = require('./routes/bank.routes');
const bankAccountRoutes = require('./routes/bankAccounts.routes');
const productRoutes = require('./routes/product.routes');
const billsRoutes = require('./routes/bills.routes');
const attachmentsRoutes = require('./routes/attachments.routes');
const journalRoutes = require('./routes/journal.routes');
const quotationRoutes = require('./routes/quotation.routes');
const salesRoutes = require('./routes/sale.routes');
const purchaseOrderRoutes = require('./routes/purchasOrder.routes');
const paymentMethodRoutes = require('./routes/paymentMethod.routes');
const currencyRoutes = require('./routes/currency.routes');
const DbConfig = require('./config/db');

const app = express();

app.use(express.json());

// Rutas principales
app.use('/api/partner', partnerRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/accounts', bankAccountRoutes);
app.use('/api/product', productRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/attachments', attachmentsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/quotation',quotationRoutes)
app.use('/api/sales', salesRoutes);
app.use('/api/purchase-order',purchaseOrderRoutes)
app.use('/api/payment-method', paymentMethodRoutes);
app.use('/api/currency', currencyRoutes);

// Initialize the database connection

(async () => {
  const db = await DbConfig.init(config.database);
  if (!db.success) {
    console.error('Error connecting to the database:', db.message);
  } else {
    console.log('Connected to MySQL database');
  }
})();


// Ruta por defecto
app.get('/', (req, res) => {
  res.json({
    message: 'API Express para Odoo',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      odoo: '/api/odoo',
      health: '/health'
    }
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

const PORT = config.port || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Entorno: ${config.nodeEnv}`);
  console.log(`🔗 Odoo URL: ${config.odooUrl}`);
});

module.exports = app;
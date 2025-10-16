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
const radianRoutes = require('./routes/radian.routes');
const DbConfig = require('./config/db');
const { cron } = require('./job/corn');
const { getBillsStay } = require('./Repository/lotesprocesarfactura/lotesprocesarfactura.repository');
const { lotesService } = require('./services/BillLotesDb.service');
const { getCreditNotesStay } = require('./Repository/lotesprocesarnotacredito/lotesprocesarnotacredito.repository');
const { getDebitNotesStay } = require('./Repository/lotesprocesarnotadebito/lotesprocesarnotadebito.repository');
const payrollRoutes = require('./routes/payroll.routes');
const employeeRoutes = require('./routes/employee.routes');
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
app.use('/api/quotation', quotationRoutes)
app.use('/api/sales', salesRoutes);
app.use('/api/purchase-order', purchaseOrderRoutes)
app.use('/api/payment-method', paymentMethodRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/radian', radianRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/employee', employeeRoutes);

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

cron.schedule('*/10 * * * *', async () => {
  try {
    console.log(`[CRON] Tarea cada 10 minutos ${JSON.stringify((await getBillsStay()).data.map(item => item.idexterno))}`, new Date().toISOString());

    const idsBills = (await getBillsStay()).data.map(item => item.idexterno);
    const idsCreditNote = (await getCreditNotesStay()).data.map(item => item.idexterno);
    const idsDebitNote = (await getDebitNotesStay()).data.map(item => item.idexterno);


    await lotesService.processJobFacturas(idsBills, '01');
    await lotesService.processJobFacturas(idsCreditNote, '91');
    await lotesService.processJobFacturas(idsDebitNote, '92');

  } catch (e) {
    console.error('Error en el cron:', e.message || e);
    return;
  }

}, { scheduled: true, timezone: 'America/Bogota' });

const PORT = config.port || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Entorno: ${config.nodeEnv}`);
  console.log(`🔗 Odoo URL: ${config.odooUrl}`);
});

module.exports = app;
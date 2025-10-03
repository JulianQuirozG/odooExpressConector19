const { z } = require('zod');
const { createQuotationSchema } = require('../Quotation/createQuotation.schema');


const createSaleSchema = z.object({
  dataVenta: createQuotationSchema,
  dataCompra: createQuotationSchema
}).strict();

module.exports = { createSaleSchema };
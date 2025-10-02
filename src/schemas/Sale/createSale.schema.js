const { z } = require('zod');
const { createQuotationSchema } = require('../Quotation/createQuotation.schema');


const createSaleSchema = z.object({
  dataVenta: z.object(createQuotationSchema)
}).strict();

module.exports = createSaleSchema;
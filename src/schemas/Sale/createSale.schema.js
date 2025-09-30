const { z } = require('zod');
const { createQuotationSchema } = require('../Quotation/createQuotation.schema');


const createSaleSchema = z.object({
  dataVenta: z.object(createQuotationSchema)
});

module.exports = createSaleSchema;
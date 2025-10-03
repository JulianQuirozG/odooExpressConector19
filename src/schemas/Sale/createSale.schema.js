const { z } = require('zod');
const { createQuotationSchema, orderLineSchema } = require('../Quotation/createQuotation.schema');


const createSaleSchema = z.object({
  dataVenta: createQuotationSchema,
  dataCompra: z.object({
    partner_id: z.number().min(1),
    date_planned: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }),
    order_line: orderLineSchema.optional(),
  })
}).strict();

module.exports = { createSaleSchema };
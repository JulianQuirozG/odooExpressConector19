const { z } = require('zod');

const orderLineSchema =
  z.object({
    product_id: z.number().min(1),
    product_uom_qty: z.number().min(0).optional(),
    product_uom_id: z.number().min(1).optional(),
    price_unit: z.number().min(0).optional(),
    tax_ids: z.array(z.number().min(1)).optional(),
    name: z.string().min(2).max(100).optional(),
    x_studio_rad_rndc: z.string().optional(),   
    x_studio_n_remesa: z.string().optional()
  });

const createQuotationSchema = z.object({
  partner_id: z.number().min(1).optional(),
  external_partner_id: z.string().min(1).optional(),
  date_order: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }).optional(),
  date_planned : z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }).optional(),
  validity_date: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }).optional(),
  payment_term_id: z.number().min(1),
  order_line: z.array(orderLineSchema).min(1, { message: 'Debe haber al menos una línea de pedido' }),
  l10n_co_edi_payment_option_id: z.number(),
  l10n_co_edi_operation_type: z.string(),
}).strict();

module.exports = { createQuotationSchema, orderLineSchema };

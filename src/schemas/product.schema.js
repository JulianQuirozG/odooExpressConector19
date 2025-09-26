const { z } = require('zod');

const productSchema = z.object({
    name: z.string().optional(),
    default_code: z.string().optional(),
    type: z.enum(['product', 'consu', 'service']).optional(),
    list_price: z.number().optional(),
    standard_price: z.number().optional(),
    uom_id: z.number().optional(),
    uom_po_id: z.number().optional(),
    sale_ok: z.boolean().optional(),
    purchase_ok: z.boolean().optional(),
    description: z.string().optional(),
    company_id: z.number().optional()
}).strict(); // ← impide campos no definidos

module.exports = productSchema;
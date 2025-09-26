const { z } = require('zod');

const invoiceLineSchema = z.object({
    product_id: z.number(),
    name: z.string().optional(),
    quantity: z.number(),
    price_unit: z.number(),
    tax_ids: z.array(z.number()).optional(),
    account_id: z.number().optional()
});

const billSchema = z.object({
    move_type: z.enum(['in_invoice', 'out_invoice', 'in_refund', 'out_refund']),
    partner_id: z.number(),
    invoice_date: z.string(),
    invoice_date_due: z.string(),
    ref: z.string().optional(),
    currency_id: z.number(),
    company_id: z.number(),
    journal_id: z.number().optional(),
    invoice_line_ids: z.array(invoiceLineSchema).optional(),
    payment_reference: z.string().optional(),
    invoice_origin: z.string().optional(),
    state: z.string().optional()
}).strict(); // ← impide campos no definidos

module.exports = billSchema;
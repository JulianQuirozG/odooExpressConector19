const { z } = require('zod');

const createdPaymentSchema = z.object({
    amount: z.number().min(1).optional(),
    date: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }),
    journal_id: z.number().min(1), // En este momento deberia ser 6, pero depende del metodo de pago
    payment_method_line_id: z.number().min(1),
}).strict(); 

module.exports = createdPaymentSchema;

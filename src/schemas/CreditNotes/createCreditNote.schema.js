const { z } = require('zod');

const createCreditNoteSchema = z.object({
    date: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }),
    journal_id: z.number().min(1) // Deberia ser 2 si es ventas o 1 si es compras
}).strict(); 

module.exports = createCreditNoteSchema;

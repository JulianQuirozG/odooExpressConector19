const { z } = require('zod');

const createCreditNoteSchema = z.object({
    date: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: 'Debe ser una fecha válida' }),
    journal_id: z.number().min(1)
}).strict(); 

module.exports = createCreditNoteSchema;

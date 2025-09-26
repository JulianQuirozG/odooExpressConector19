const { z } = require('zod');

// Definimos el esquema para un cliente
const updateClientSchema = z.object({
  name: z.string()
    .min(1, 'El nombre no puede estar vacío').optional(),

  company_type: z.enum(['person', 'company'], {
    required_error: 'Debe especificar si es persona o empresa',
    invalid_type_error: 'Tipo de compañía inválido'
  }).optional(),
  is_company: z.boolean().optional(),
  street2: z.string().optional(),
  zip: z.string().optional(),
  state_id: z.number().optional(),
  website: z.string().optional(),
  category_id: z.array(z.number()).optional(),
  active: z.boolean().optional(),
  function: z.string().optional(),
  comment: z.string().optional(),
  lang: z.string()
    .regex(/^[a-z]{2}_[A-Z]{2}$/, 'El idioma debe tener el formato correcto (por ejemplo: es_CO)').optional(),

  mobile: z.string()
    .min(7, 'El número de celular debe tener al menos 7 dígitos').optional(),

  phone: z.string()
    .min(7, 'El teléfono debe tener al menos 7 dígitos').optional(),

  vat: z.string()
    .min(5, 'El NIT (VAT) no puede estar vacío').optional(),

  email: z.email({ message: 'Debe proporcionar un correo electrónico válido' }).optional(),

  street: z.string()
    .min(1, 'La dirección no puede estar vacía').optional(),

  city: z.string()
    .min(1, 'La ciudad no puede estar vacía').optional(),

  customer_rank: z.number()
    .int()
    .min(1, 'El rango del cliente debe ser al menos 1').optional(),

  country_id: z.number()
    .int()
    .min(1, 'Debe proporcionar un ID de país válido y mayor que 0').optional(),
  company_id: z.number()
    .int()
    .min(1, 'Debe proporcionar un ID de compañía válido y mayor que 0').optional(),
  supplier_rank: z.number()
    .int()
    .min(0, 'El rango del proveedor debe ser al menos 0').optional()
}).strict();


module.exports = updateClientSchema;
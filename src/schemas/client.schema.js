const { z } = require('zod');
const nitRegex = /^\d{7,10}(-\d)?$/;


const bankAccountSchema = z.object({
  acc_number: z.string().min(1),
  currency_id: z.coerce.number().int().min(1),
  acc_holder_name: z.string().min(1),
  bank_name: z.string().min(1),
  bic: z.string().min(3)
});


const clientSchema = z.object({
  // Identificación básica
  is_company: z.boolean(),
  company_type: z.enum(['company', 'person']),
  parent_id: z.number().int().min(1).nullable().optional(),

  // Datos generales
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  street: z.string().min(1),
  street2: z.string().optional().default(''),
  lang: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/, 'Formato idioma ej: es_CO'),
  city: z.string().min(1),
  city_id: z.coerce.number().int().min(1),
  zip: z.string().min(1),
  state_id: z.coerce.number().int().min(1),
  country_id: z.coerce.number().int().min(1),
  function: z.string().optional().default(''),

  // Identificación fiscal
  l10n_latam_identification_type_id: z.coerce.number().int().min(1),
  vat: z.string().min(3),
  website: z.string().min(1), // puede ser email/URL según tu uso
  category_id: z.null().or(z.array(z.coerce.number().int().min(1))).optional(),

  company_id: z.coerce.number().int().min(1),

  // Ranks
  customer_rank: z.coerce.number().int().min(0),
  supplier_rank: z.coerce.number().int().min(0),

  // Ventas/Compras
  user_id: z.coerce.number().int().min(1),
  property_payment_term_id: z.coerce.number().int().min(1),
  property_inbound_payment_method_line_id: z.coerce.number().int().min(1),

  property_supplier_payment_term_id: z.coerce.number().int().min(1),
  property_outbound_payment_method_line_id: z.coerce.number().int().min(1),
  property_purchase_currency_id: z.coerce.number().int().min(1),

  // Fiscal DIAN
  l10n_co_edi_obligation_type_ids: z.array(z.coerce.number().int().min(1)).min(1),
  l10n_co_edi_large_taxpayer: z.boolean(),
  l10n_co_edi_fiscal_regimen: z.enum(['48', '49']),
  l10n_co_edi_commercial_name: z.string().min(1),

  // Varios
  industry_id: z.coerce.number().int().min(1).optional(),

  // Inventario
  property_stock_customer: z.coerce.number().int().min(1),
  property_stock_supplier: z.coerce.number().int().min(1),

  // Seguimiento de facturas
  followup_reminder_type: z.enum(['automatic', 'manual', 'none']).default('automatic'),

  // Contabilidad
  // aceptar número o [id] (como en tu ejemplo)
  property_account_receivable_id: z.union([
    z.coerce.number().int().min(1),
    z.tuple([z.coerce.number().int().min(1)])
  ]),
  property_account_payable_id: z.union([
    z.coerce.number().int().min(1),
    z.tuple([z.coerce.number().int().min(1)])
  ]),
  autopost_bills: z.enum(['ask', 'no', 'all']).default('ask'),
  ignore_abnormal_invoice_amount: z.union([z.boolean(), z.literal(0), z.literal(1)]),
  ignore_abnormal_invoice_date: z.union([z.boolean(), z.literal(0), z.literal(1)]),

  // Invoicing
  invoice_sending_method: z.enum(['email', 'manual', 'none']).default('email'),
  // opcionales
  invoice_edi_format: z.string().optional(),
  peppol_eas: z.string().optional(),
  peppol_endpoint: z.string().optional(),
  comment: z.string().optional().default(''),

  // Cuentas bancarias
  bankAccounts: z.array(bankAccountSchema).min(0)
}).strict(); // ← impide campos no definidos

module.exports = {clientSchema};
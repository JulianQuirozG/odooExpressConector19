const { z } = require('zod');

const productSchema = z.object({
  name: z.string({
    required_error: "El campo 'name' es obligatorio.",
  }),

  type: z.enum(["consu", "service", "product"], {
    required_error: "El campo 'type' es obligatorio.",
  }),

  sale_ok: z.boolean({
    required_error: "El campo 'sale_ok' es obligatorio.",
  }),

  purchase_ok: z.boolean({
    required_error: "El campo 'purchase_ok' es obligatorio.",
  }),

  purchase_method: z.enum(["purchase", "receive"], {
    required_error: "El campo 'purchase_method' es obligatorio.",
  }),

  uom_id: z.number({
    required_error: "El campo 'uom_id' es obligatorio.",
  }),

  list_price: z.number({
    required_error: "El campo 'list_price' es obligatorio.",
  }),

  l10n_co_dian_mandate_contract: z.boolean({
    required_error: "El campo 'l10n_co_dian_mandate_contract' es obligatorio.",
  }),

  service_to_purchase: z.boolean({
    required_error: "El campo 'service_to_purchase' es obligatorio.",
  }),

  // Campos opcionales
  active: z.boolean().optional(),
  standard_price: z.number().optional(),
  taxes_id: z.array(z.number()).optional(),
  supplier_taxes_id: z.array(z.number()).optional(),
  categ_id: z.number().optional(),
  service_type: z.enum(["manual", "timesheet", "project"]).optional(),
  service_tracking: z.enum(["no", "task_global_project", "task_new_project"]).optional(),
  invoice_policy: z.enum(["order", "delivery"]).optional(),
  description: z.string().optional(),

  seller_ids: z.array(
    z.object({
      partner_id: z.number(),
      min_qty: z.number(),
      price: z.number(),
      delay: z.number(),
    })
  ).optional(),

  property_account_income_id: z.number().optional(),
  property_account_expense_id: z.number().optional(),
});

module.exports = productSchema;

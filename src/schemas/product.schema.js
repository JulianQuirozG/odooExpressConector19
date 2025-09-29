const { z } = require('zod');

const productSellerSchema = z.object({
    partner_id: z.number(),
    min_qty: z.number().default(1),
    price: z.number(),
    delay: z.number().default(1),
    currency_id: z.number().optional()
});

const productSchema = z.object({
    // BÁSICOS OBLIGATORIOS
    name: z.string().min(1, "El nombre es obligatorio"),
    type: z.enum(['product', 'service', 'consu']).default('service'),
    active: z.boolean().default(true),

    // VENTAS
    sale_ok: z.boolean().default(true),
    list_price: z.number().min(0).default(0),
    taxes_id: z.array(z.number()).optional([[4, 55]]),

    // COMPRAS
    purchase_ok: z.boolean().default(true),
    standard_price: z.number().min(0).default(0),
    supplier_taxes_id: z.array(z.number()).optional([[4, 5]]),

    // CATEGORIZACIÓN
    categ_id: z.number().optional(),
    default_code: z.string().optional(),
    barcode: z.string().optional(),

    // UNIDADES
    uom_id: z.number().optional(),

    // SERVICIOS
    service_type: z.enum(['manual', 'timesheet']).optional(),
    service_tracking: z.enum(['no', 'task_global_project', 'task_in_project']).default('no'),
    invoice_policy: z.enum(['order', 'delivery']).default('order'),
    purchase_method: z.enum(['purchase', 'receive']).default('purchase'),

    // INVENTARIO
    tracking: z.enum(['none', 'lot', 'serial']).default('none'),

    // ADICIONALES
    description: z.string().optional(),
    weight: z.number().min(0).default(0),
    volume: z.number().min(0).default(0),
    image_1920: z.string().optional(), // Base64 de la imagen

    // PROVEEDORES
    seller_ids: z.array(productSellerSchema).optional(),
    property_account_income_id: z.number().optional(),
    property_account_expense_id: z.number().optional(),
    property_stock_account_input: z.number().optional(),
    l10n_co_dian_mandate_contract: z.boolean().optional(),
    company_id: z.number().optional(),
    service_to_purchase: z.boolean().optional()

}).strict();

module.exports = { productSchema, productSellerSchema };
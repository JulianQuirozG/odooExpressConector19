const { z } = require('zod');

// Schema para las líneas de orden de compra
const purchaseOrderLineSchema = z.object({
    display_type: z.boolean().default(false),
    technical_price_unit: z.number().min(0),
    sequence: z.number().int().positive().default(10),
    product_id: z.number().int().positive(),
    name: z.string().min(1, "El nombre del producto es obligatorio"),
    date_planned: z.string().datetime(), // ISO datetime string
    move_dest_ids: z.array(z.number()).default([]),
    propagate_cancel: z.boolean().default(true),
    product_qty: z.number().min(0).default(1),
    qty_received_manual: z.number().min(0).default(0),
    qty_received: z.number().min(0).default(0),
    product_uom_id: z.number().int().positive(),
    price_unit: z.number().min(0),
    tax_ids: z.array(z.array(z.number())).default([]), // Array de arrays para formato Odoo
    discount: z.number().min(0).max(100).default(0)
});

// Schema principal para purchase.order
const purchaseOrderSchema = z.object({
    // CONFIGURACIONES BÁSICAS
    locked: z.boolean().default(false),
    priority: z.enum(["0", "1", "2", "3"]).default("0"), // 0=Normal, 1=Bajo, 2=Alto, 3=Urgente

    // PARTNER Y EMPRESA
    partner_id: z.number().int().positive(),
    partner_ref: z.union([z.string(), z.boolean()]).default(false),
    company_id: z.number().int().positive().default(1),

    // MONEDA Y FINANZAS
    currency_id: z.number().int().positive(),
    payment_term_id: z.union([z.number().int().positive(), z.boolean()]).default(false),
    fiscal_position_id: z.union([z.number().int().positive(), z.boolean()]).default(false),

    // FECHAS
    date_order: z.string().datetime(),
    date_planned: z.string().datetime(),

    // CONFIGURACIONES DE RECEPCIÓN
    receipt_reminder_email: z.boolean().default(false),
    reminder_date_before_receipt: z.number().int().min(0).default(1),
    picking_type_id: z.number().int().positive(),
    dest_address_id: z.union([z.number().int().positive(), z.boolean()]).default(false),

    // LÍNEAS DE ORDEN (OBLIGATORIO)
    order_line: z.array(
        z.tuple([
            z.literal(0),                    // Primer elemento: 0 (crear nuevo)
            z.string(),                      // Segundo elemento: ID virtual
            purchaseOrderLineSchema          // Tercer elemento: datos de la línea
        ])
    ).min(1, "Debe incluir al menos una línea de producto"),

    // INFORMACIÓN ADICIONAL
    note: z.union([z.string(), z.boolean()]).default(false),
    user_id: z.number().int().positive(),
    origin: z.union([z.string(), z.boolean()]).default(false),

    // TÉRMINOS INTERNACIONALES
    incoterm_id: z.union([z.number().int().positive(), z.boolean()]).default(false),
    incoterm_location: z.union([z.string(), z.boolean()]).default(false)

}).strict();

// Schema simplificado para la API (más fácil de usar)
const purchaseOrderSimpleSchema = z.object({
    // OBLIGATORIOS
    partner_id: z.number().int().positive(),
    currency_id: z.number().int().positive(),

    // LÍNEAS SIMPLIFICADAS
    order_line: z.array(z.object({
        product_id: z.number().int().positive(),
        name: z.string().min(1),
        product_qty: z.number().min(0).default(1),
        price_unit: z.number().min(0),
        product_uom_id: z.number().int().positive(),
        tax_ids: z.array(z.number()).optional(),
        discount: z.number().min(0).max(100).default(0),
        date_planned: z.string().datetime().optional()
    })).min(1),

    // OPCIONALES
    priority: z.enum(["0", "1", "2", "3"]).default("0"),
    date_order: z.string().datetime().optional(),
    date_planned: z.string().datetime().optional(),
    payment_term_id: z.number().int().positive().optional(),
    user_id: z.number().int().positive().optional(),
    note: z.string().optional(),
    partner_ref: z.string().optional(),
    origin: z.string().optional(),
    picking_type_id: z.number().int().positive().optional(),
    company_id: z.number().int().positive().default(1)
});

module.exports = {
    purchaseOrderSchema,
    purchaseOrderLineSchema,
    purchaseOrderSimpleSchema
};
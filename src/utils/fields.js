const CLIENT_FIELDS = [
    "is_company",
    "company_type",
    "parent_id",
    "name",
    "email",
    "phone",
    "street",
    "street2",
    "lang",
    "city",
    "zip",
    "state_id",
    "country_id",
    "function",
    "l10n_latam_identification_type_id",
    "vat",
    "website",
    "category_id",
    "company_id",
    "customer_rank",
    "supplier_rank",
    "user_id",
    "property_payment_term_id",
    "property_inbound_payment_method_line_id",
    "property_account_position_id",
    "property_supplier_payment_term_id",
    "property_outbound_payment_method_line_id",
    "company_registry",
    "ref",
    "industry_id",
    "property_stock_customer",
    "ignore_abnormal_invoice_amount",
    "ignore_abnormal_invoice_date",
    "invoice_sending_method",
    "invoice_edi_format",
    "peppol_eas",
    "peppol_endpoint",
    "comment"

    // ...otros campos de cliente
];


const BANK_FIELDS = [
    "display_name", "name", "bic"
    // ...otros campos de banco
];

const BANK_ACCOUNT_FIELDS = [
    "acc_number", "partner_id", "bank_id", "currency_id", "company_id", "sanitized_acc_number"
    // ...otros campos de cuenta bancaria
];

const BANK_ACCOUNT_PARTNER_FIELDS = [
    "acc_number", "partner_id", "bank_id", "bank_name", "currency_id", "company_id", "sanitized_acc_number"
    // ...otros campos de cuenta bancaria
];
const PROVIDER_FIELDS = [
    "is_company",
    "company_type",
    "parent_id",
    "name",
    "email",
    "phone",
    "street",
    "street2",
    "lang",
    "city",
    "zip",
    "state_id",
    "country_id",
    "function",
    "l10n_latam_identification_type_id",
    "vat",
    "website",
    "category_id",
    "company_id",
    "customer_rank",
    "supplier_rank",
    "user_id",
    "property_payment_term_id",
    "property_inbound_payment_method_line_id",
    "property_account_position_id",
    "property_supplier_payment_term_id",
    "property_outbound_payment_method_line_id",
    "company_registry",
    "ref",
    "industry_id",
    "property_stock_customer",
    "ignore_abnormal_invoice_amount",
    "ignore_abnormal_invoice_date",
    "invoice_sending_method",
    "invoice_edi_format",
    "peppol_eas",
    "peppol_endpoint",
    "comment"
];

const PRODUCT_FIELDS = [
    "name", "default_code", "type",            // 'product', 'consu', 'service'
    "list_price", "standard_price", "categ_id", "uom_id", "uom_po_id", "barcode",
    "sale_ok", "purchase_ok", "active", "description", "image_1920", "company_id",
    "taxes_id", "supplier_taxes_id", "weight", "volume", "tracking","service_to_purchase","l10n_co_dian_mandate_contract",
    "property_account_income_id","property_account_expense_id","property_stock_account_input","purchase_method"
];

const PRODUCT_FIELDS_BILL = [
    "product_id", "name", "default_code", "type",            // 'product', 'consu', 'service'
    "list_price", "standard_price", "categ_id", "uom_id", "uom_po_id", "barcode",
    "sale_ok", "purchase_ok", "active", "description", "image_1920", "company_id",
    "taxes_id", "supplier_taxes_id", "weight", "volume", "tracking",
];

const BILL_FIELDS = [
    "move_type", "partner_id", "invoice_date", "invoice_date_due", "ref",
    "currency_id", "company_id", "journal_id", "narration", "payment_reference",
    "payment_reference", "invoice_origin", "state", "partner_bank_id", "invoice_vendor_bill_id"
];

const INVOICE_LINE_FIELDS = [
    "product_id",      // ID del producto
    "name",            // Descripción de la línea
    "quantity",        // Cantidad
    "price_unit",      // Precio unitario
    "tax_ids",         // IDs de impuestos
    "account_id"       // ID de la cuenta contable
    // ...otros campos de línea si los necesitas
];

const QUOTATION_LINES_FIELDS = ["partner_id","order_line"];


const QUOTATION_LINES = [
    0, 0,
    {
        product_id: 5,
        name: "Descripción",
        product_uom_qty: 1,
        price_unit: 130000,
        tax_ids: [[4, 51]]
    }
];

const QUOTATION_FIELDS = ["partner_id",
    "order_line"];

module.exports = {
    CLIENT_FIELDS,
    BANK_FIELDS,
    BANK_ACCOUNT_FIELDS,
    PROVIDER_FIELDS,
    PRODUCT_FIELDS,
    INVOICE_LINE_FIELDS,
    BILL_FIELDS,
    BANK_ACCOUNT_PARTNER_FIELDS,
    PRODUCT_FIELDS_BILL,
    QUOTATION_FIELDS,
    QUOTATION_LINES
};
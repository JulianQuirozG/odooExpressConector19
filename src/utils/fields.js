const CLIENT_FIELDS = [
    "name", "is_company", "company_type", "lang", "phone", "vat", "email",
    "street", "city",  "zip","customer_rank", "country_id", "company_id","website","parent_id"
    // ...otros campos de cliente
];


const BANK_FIELDS = [
    "display_name","name", "bic"
    // ...otros campos de banco
];

const BANK_ACCOUNT_FIELDS = [
    "acc_number","partner_id","bank_id", "currency_id", "company_id","sanitized_acc_number"
    // ...otros campos de cuenta bancaria
];

const BANK_ACCOUNT_PARTNER_FIELDS = [
    "acc_number","partner_id","bank_id","bank_name" , "currency_id", "company_id","sanitized_acc_number"
    // ...otros campos de cuenta bancaria
];
const PROVIDER_FIELDS = [
    "name", "is_company", "company_type", "lang", "phone", "vat", "email",
    "street","street2", "zip","country_id","supplier_rank", "company_id", "website",
    "parent_id"
    // ...otros campos de proveedor
];

const PRODUCT_FIELDS = [
    "name", "default_code", "type",            // 'product', 'consu', 'service'
    "list_price", "standard_price", "categ_id", "uom_id", "uom_po_id", "barcode",
    "sale_ok", "purchase_ok", "active", "description", "image_1920", "company_id",
    "taxes_id", "supplier_taxes_id", "weight", "volume", "tracking",
];

const PRODUCT_FIELDS_BILL = [
    "product_id","name", "default_code", "type",            // 'product', 'consu', 'service'
    "list_price", "standard_price", "categ_id", "uom_id", "uom_po_id", "barcode",
    "sale_ok", "purchase_ok", "active", "description", "image_1920", "company_id",
    "taxes_id", "supplier_taxes_id", "weight", "volume", "tracking",
];

const BILL_FIELDS = [
    "move_type", "partner_id", "invoice_date", "invoice_date_due", "ref", 
    "currency_id", "company_id", "journal_id", "narration", 
    "payment_reference", "invoice_origin", "state"                
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
module.exports = {
    CLIENT_FIELDS,
    BANK_FIELDS,
    BANK_ACCOUNT_FIELDS,
    PROVIDER_FIELDS,
    PRODUCT_FIELDS,
    INVOICE_LINE_FIELDS,
    BILL_FIELDS,
    BANK_ACCOUNT_PARTNER_FIELDS,
    PRODUCT_FIELDS_BILL
};
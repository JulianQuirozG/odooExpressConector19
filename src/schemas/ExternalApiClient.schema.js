
const { z } = require('zod');

const bankSchema = z.object({
	bank_name: z.string(),
	bic: z.string(),
});

const bankAccountSchema = z.object({
	acc_number: z.string().optional(),
	currency_id: z.number().optional(),
	acc_holder_name: z.string().optional(),
	bank: bankSchema,
});

const externalApiClientSchema = z.object({
	name: z.string().optional(),
	is_company: z.boolean().optional(),
	company_type: z.string().optional(),
	lang: z.string().optional(),
	mobile: z.string().optional(),
	phone: z.string().optional(),
	vat: z.string().optional(),
	email: z.email().optional(),
	street: z.string().optional(),
	city: z.string().optional(),
	customer_rank: z.number().optional(),
	country_id: z.number().optional(),
	company_id: z.number().optional(),
	bankAccounts: z.array(bankAccountSchema).optional(),
});

module.exports = externalApiClientSchema;

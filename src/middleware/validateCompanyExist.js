const CompanyService = require('../helpers/company.service');
const OdooConnector = require('../util/odooConector.util');

const connector = new OdooConnector();
const companyService = new CompanyService(connector);

async function validateCompanyExists(req, res, next) {
    
    // Inicializamos correctamente companyId
    const companyId = Number(req.query?.company_id || req.body?.company_id);

    // Permitir que pase si company_id está vacío o es 0
    if (!companyId || companyId === 0) {
        return next(); // Permitir que pase sin validar la compañía
    }
    // Validar que companyId sea un número válido
    const companyIdNumber = Number(companyId);
    if (isNaN(companyIdNumber) || companyIdNumber <= 0) {
        return res.status(400).json({ error: 'company_id debe ser un número válido mayor que 0' });
    }
    try {
        const exists = await companyService.companyExists(companyId,user);
        if (!exists) {
            return res.status(404).json({ error: 'La compañía especificada no existe' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Error validando la compañía' });
    }
}

module.exports = { validateCompanyExists };
const z = require('zod')

// Middleware para validar los parámetros del body
const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            // Validamos el body con el esquema proporcionado
            schema.parse(req.body);
            next(); // Si pasa la validación, continúa con la siguiente función
        } catch (error) {
            // Si el error es una instancia de ZodError, lo manejamos de manera específica
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    message: 'Errores de validación en el body',
                    errors: error.issues.map(e => ({
                        field: e.path.join('.'), // Nombre del campo que falló
                        message: e.message // Mensaje de error de Zod
                    }))
                });
            }

            // Si el error no es un ZodError, lo pasamos al siguiente middleware de error
            next(error);
        }
    };
};

module.exports = { validateBody };

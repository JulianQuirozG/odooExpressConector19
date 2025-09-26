// Middleware para validar los parámetros de el parametro ID
const validateClientId = (req, res, next) => {
    const { id } = req.params;

    // Verificamos que el ID sea un número válido
    if (!id || isNaN(id) || id < 0) {
        return res.status(400).json({
            message: 'ID de cliente inválido',
            errors: [
                {
                    field: 'id',
                    message: 'El ID debe ser un número válido'
                }
            ]
        });
    }

    next(); // Si pasa la validación, continua con la siguiente función
};

module.exports = { validateClientId };

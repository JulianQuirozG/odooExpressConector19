const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
  console.error('Error Stack:', err.stack);

  // Error de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      details: err.message
    });
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token JWT inválido'
    });
  }

  // Error de token expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token JWT expirado'
    });
  }

  // Error de conexión con Odoo
  if (err.message.includes('Odoo') || err.message.includes('ECONNREFUSED')) {
    return res.status(502).json({
      error: 'Error de conexión con Odoo',
      message: 'No se pudo conectar con el servidor de Odoo'
    });
  }

  // Error 404
  if (err.status === 404) {
    return res.status(404).json({
      error: 'Recurso no encontrado'
    });
  }

  // Error por defecto
  const status = err.status || 500;
  const message = config.nodeEnv === 'development' 
    ? err.message 
    : 'Error interno del servidor';

  res.status(status).json({
    error: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
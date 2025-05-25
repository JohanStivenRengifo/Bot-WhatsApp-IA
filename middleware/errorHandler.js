const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    // Registrar el error
    logger.error('Error en la aplicación:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Determinar el código de estado HTTP
    const statusCode = err.statusCode || 500;

    // Preparar la respuesta
    const response = {
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Error interno del servidor'
            : err.message
    };

    // Incluir detalles adicionales en desarrollo
    if (process.env.NODE_ENV !== 'production') {
        response.error = {
            name: err.name,
            message: err.message,
            stack: err.stack
        };
    }

    // Enviar respuesta al cliente
    res.status(statusCode).json(response);
};

module.exports = errorHandler;

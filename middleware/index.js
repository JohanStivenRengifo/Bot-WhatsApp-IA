// middleware/index.js
const config = require('../config');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const inputSanitizer = require('../utils/inputSanitizer');
const debugMiddleware = require('./debugMiddleware');
const authMiddleware = require('./authMiddleware');
const errorHandler = require('./errorHandler');
const webhookVerificationMiddleware = require('./webhookVerificationMiddleware');

/**
 * Middleware para validar solicitudes a la API
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const validateApiRequest = (req, res, next) => {
    // Aquí se podría implementar validación de API keys, rate limiting, etc.
    // Por ahora, solo pasamos al siguiente middleware
    next();
};

/**
 * Middleware para manejar errores
 * @param {Error} err - Objeto de error
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const errorHandlerMiddleware = (err, req, res, next) => {
    logger.error('❌ Error en aplicación:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: config.app.nodeEnv === 'production'
            ? 'Error interno del servidor'
            : err.message
    });
};

/**
 * Middleware para sanitización de requests
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const sanitizeRequest = (req, res, next) => {
    try {
        if (req.body) {
            req.sanitizedBody = inputSanitizer.sanitizeConversationData(req.body);
        }
        next();
    } catch (error) {
        logger.error('Error en sanitización:', error);
        next(error);
    }
};

/**
 * Middleware para registrar solicitudes HTTP
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Registrar información de la solicitud
    logger.debug(`📥 ${req.method} ${req.originalUrl}`);

    // Función para registrar al finalizar la respuesta
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('📊 Request processed', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`
        });

        // Actualizar métricas
        metrics.updateRequestMetrics(req.method, res.statusCode, duration);
    });

    next();
};

/**
 * Middleware para verificar si el servicio está en mantenimiento
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const maintenanceMode = (req, res, next) => {
    // Verificar si el modo de mantenimiento está activado
    // Esto podría ser una variable de entorno o una configuración en base de datos
    const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

    if (isMaintenanceMode) {
        return res.status(503).json({
            success: false,
            message: 'El servicio está en mantenimiento. Por favor, inténtelo más tarde.'
        });
    }

    next();
};

// Exportar los middleware
module.exports = {
    debugMiddleware,
    authMiddleware,
    errorHandler,
    webhookVerificationMiddleware,
    validateApiRequest,
    sanitizeRequest,
    requestLogger,
    maintenanceMode
};
// middleware/authMiddleware.js
const logger = require('../utils/logger');
const config = require('../config');

const authMiddleware = (req, res, next) => {
    // Verificar token si la ruta lo requiere
    const token = req.headers['x-api-token'];

    if (!token) {
        logger.warn('Intento de acceso sin token de API');
        return res.status(401).json({
            success: false,
            message: 'Token de API faltante'
        });
    }

    if (token !== config.app.apiToken) {
        logger.warn('Intento de acceso con token de API inválido');
        return res.status(401).json({
            success: false,
            message: 'Token de API inválido'
        });
    }

    next();
};

module.exports = authMiddleware;

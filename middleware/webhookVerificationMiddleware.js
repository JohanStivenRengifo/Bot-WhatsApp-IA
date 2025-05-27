const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware para verificar las solicitudes de webhook de WhatsApp
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const webhookVerificationMiddleware = (req, res, next) => {
    // Verificar si es una solicitud de verificación de webhook
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Verificar el token
        if (mode === 'subscribe' && token === config.meta.verifyToken) {
            logger.info('✅ Webhook verificado exitosamente');
            res.status(200).send(challenge);
        } else {
            logger.error('❌ Error en verificación de webhook: Token inválido');
            res.sendStatus(403);
        }
    } else {
        // Si no es una solicitud de verificación, continuar al siguiente middleware
        next();
    }
};

module.exports = webhookVerificationMiddleware; 
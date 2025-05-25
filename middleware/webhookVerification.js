const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware para verificar las solicitudes del webhook de WhatsApp
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const webhookVerificationMiddleware = (req, res, next) => {
    // Verificar si es una solicitud de verificación del webhook
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        logger.info('🔄 Verificación de webhook recibida', {
            mode,
            token,
            challenge: challenge ? 'presente' : 'ausente'
        });

        // Verificar el token
        if (token === config.meta.verifyToken) {
            logger.info('✅ Token de verificación válido');
            res.status(200).send(challenge);
        } else {
            logger.error('❌ Token de verificación inválido');
            res.status(403).json({ error: 'Token de verificación inválido' });
        }
        return;
    }

    // Para otras solicitudes, verificar la firma del webhook
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        logger.error('❌ Firma del webhook no presente');
        return res.status(401).json({ error: 'Firma del webhook no presente' });
    }

    // Verificar la firma del webhook
    const hmac = crypto.createHmac('sha256', config.meta.appSecret);
    const expectedSignature = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;

    if (signature !== expectedSignature) {
        logger.error('❌ Firma del webhook inválida');
        return res.status(401).json({ error: 'Firma del webhook inválida' });
    }

    logger.info('✅ Firma del webhook válida');
    next();
};

module.exports = webhookVerificationMiddleware; 
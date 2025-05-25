// middleware/debugMiddleware.js
const logger = require('../utils/logger');

const debugMiddleware = (req, res, next) => {
    logger.debug('📥 Incoming Request:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: req.query,
        body: req.body,
        timestamp: new Date().toISOString()
    });

    // Capturar y registrar la respuesta
    const oldSend = res.send;
    res.send = function (data) {
        logger.debug('📤 Outgoing Response:', {
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            body: data,
            timestamp: new Date().toISOString()
        });

        // Llamar al método original
        oldSend.apply(res, arguments);
    };

    next();
};

module.exports = debugMiddleware;

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const logger = require('../utils/logger');
const tokenManager = require('../utils/tokenManager');

const router = express.Router();

// Configuración
const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function validateSignature(signature, payload) {
    const hmac = crypto.createHmac('sha1', GITHUB_SECRET);
    const digest = 'sha1=' + hmac.update(JSON.stringify(payload)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

router.post('/github', (req, res) => {
    const signature = req.headers['x-hub-signature'];
    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Validar la firma
    if (!signature || !validateSignature(signature, payload)) {
        logger.warn('Firma de webhook de GitHub inválida');
        return res.status(403).json({ error: 'Firma inválida' });
    }

    // Solo procesar eventos push
    if (event !== 'push') {
        return res.status(200).json({ message: 'Evento ignorado' });
    }

    // Ejecutar actualización
    exec('git pull && npm install && pm2 restart bot-meta', (error, stdout, stderr) => {
        if (error) {
            logger.error('Error actualizando desde GitHub:', error);
            return res.status(500).json({ error: 'Error en actualización' });
        }

        logger.info('Actualización desde GitHub exitosa:', stdout);
        res.status(200).json({ message: 'Actualización exitosa' });
    });
});

module.exports = router;

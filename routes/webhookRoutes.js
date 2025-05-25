// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * Rutas para la integración con Meta API
 */

// Verificación del webhook (GET)
router.get('/', webhookController.verifyWebhook.bind(webhookController));

// Recepción de mensajes (POST)
router.post('/', webhookController.receiveMessage.bind(webhookController));

module.exports = router;
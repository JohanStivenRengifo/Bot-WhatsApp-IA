// routes/api.js
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const webhookController = require('../controllers/webhookController');

/**
 * Rutas para gestión de conversaciones
 */
router.get('/conversations', conversationController.getAllConversations);
router.get('/conversation/:phoneNumber', conversationController.getConversationByPhone);
router.post('/conversation/:phoneNumber/reset', conversationController.resetConversation);
router.get('/conversation-stats', conversationController.getConversationStats);

/**
 * Ruta para envío manual de mensajes
 */
router.post('/send-message', webhookController.sendManualMessage);

module.exports = router;
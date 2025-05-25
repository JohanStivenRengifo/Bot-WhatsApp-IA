const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

// Proteger todas las rutas del dashboard con autenticación
router.use(authMiddleware.validateToken);

// Rutas de estadísticas
router.get('/stats', dashboardController.getStats);
router.get('/conversations/active', dashboardController.getActiveConversations);

// Gestión de tokens
router.post('/tokens/generate', dashboardController.generateNewToken);

// Handover de conversaciones
router.post('/conversations/:phoneNumber/handover', dashboardController.handoverToHuman);
router.post('/conversations/:phoneNumber/return', dashboardController.returnToBot);

module.exports = router;

import express from 'express';
import { BotControlController } from '../controllers/BotControlController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();
const botController = new BotControlController();

/**
 * Rutas para control y gestión del bot
 */

// ============ ESTADO DEL BOT ============
router.get('/status', authenticateToken, botController.getBotStatus.bind(botController));
router.get('/health', authenticateToken, botController.getBotHealth.bind(botController));

// ============ CONTROL DEL BOT (Solo administradores) ============
router.post('/pause', authenticateToken, requireRole(['admin']), botController.pauseBot.bind(botController));
router.post('/resume', authenticateToken, requireRole(['admin']), botController.resumeBot.bind(botController));
router.post('/restart', authenticateToken, requireRole(['admin']), botController.restartBot.bind(botController));

// ============ CONFIGURACIÓN DEL BOT ============
router.get('/config', authenticateToken, requireRole(['admin', 'supervisor']), botController.getBotConfig.bind(botController));
router.post('/config', authenticateToken, requireRole(['admin']), botController.updateBotConfig.bind(botController));

// ============ FLUJOS DE CONVERSACIÓN ============
router.get('/flows', authenticateToken, requireRole(['admin', 'supervisor']), botController.getAvailableFlows.bind(botController));
router.post('/flows/:flowName/enable', authenticateToken, requireRole(['admin']), botController.enableFlow.bind(botController));
router.post('/flows/:flowName/disable', authenticateToken, requireRole(['admin']), botController.disableFlow.bind(botController));

// ============ SESIONES ACTIVAS ============
router.get('/sessions', authenticateToken, requireRole(['admin', 'supervisor']), botController.getActiveSessions.bind(botController));
router.delete('/sessions/:phoneNumber', authenticateToken, requireRole(['admin']), botController.clearUserSession.bind(botController));
router.delete('/sessions', authenticateToken, requireRole(['admin']), botController.clearAllSessions.bind(botController));

// ============ MÉTRICAS DEL BOT ============
router.get('/metrics/messages', authenticateToken, botController.getMessageMetrics.bind(botController));
router.get('/metrics/flows', authenticateToken, botController.getFlowMetrics.bind(botController));
router.get('/metrics/errors', authenticateToken, botController.getErrorMetrics.bind(botController));

// ============ LOGS Y DEBUGGING ============
router.get('/logs', authenticateToken, requireRole(['admin']), botController.getBotLogs.bind(botController));
router.get('/logs/errors', authenticateToken, requireRole(['admin']), botController.getErrorLogs.bind(botController));

// ============ MANTENIMIENTO ============
router.post('/maintenance/enable', authenticateToken, requireRole(['admin']), botController.enableMaintenanceMode.bind(botController));
router.post('/maintenance/disable', authenticateToken, requireRole(['admin']), botController.disableMaintenanceMode.bind(botController));
router.get('/maintenance/status', authenticateToken, botController.getMaintenanceStatus.bind(botController));

export default router;

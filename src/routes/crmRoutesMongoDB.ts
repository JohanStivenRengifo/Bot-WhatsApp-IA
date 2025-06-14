import { Router } from 'express';
import { CRMControllerMongoDB } from '../controllers/CRMControllerMongoDB';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const crmController = new CRMControllerMongoDB();

/**
 * Rutas CRM actualizadas para MongoDB
 */

// ============ AUTENTICACIÓN ============
router.post('/auth/login', crmController.login.bind(crmController));
router.get('/auth/me', authenticateToken, crmController.getCurrentUser.bind(crmController));

// ============ DASHBOARD ============
router.get('/dashboard', authenticateToken, crmController.getDashboard.bind(crmController));

// ============ CONVERSACIONES ============
router.get('/conversations', authenticateToken, crmController.getConversations.bind(crmController));
router.get('/conversations/:id', authenticateToken, crmController.getConversationById.bind(crmController));
router.get('/conversations/:id/messages', authenticateToken, crmController.getConversationMessages.bind(crmController));
router.get('/conversations/:id/messages-full', authenticateToken, crmController.getConversationMessagesFull.bind(crmController));
router.post('/conversations/:id/send-message', authenticateToken, crmController.sendAgentMessage.bind(crmController));
router.post('/conversations/:id/end-conversation', authenticateToken, crmController.endAgentConversation.bind(crmController));
router.post('/conversations/:id/assign', authenticateToken, requireRole(['admin', 'supervisor']), crmController.assignConversation.bind(crmController));
router.post('/conversations/:id/messages', authenticateToken, crmController.sendAgentMessage.bind(crmController));
router.post('/conversations/:id/notes', authenticateToken, crmController.addNote.bind(crmController));
router.get('/conversations/:id/notes', authenticateToken, crmController.getConversationNotes.bind(crmController));

// ============ USUARIOS/AGENTES ============
router.get('/users', authenticateToken, requireRole(['admin', 'supervisor']), crmController.getUsers.bind(crmController));
router.post('/users', authenticateToken, requireRole(['admin']), crmController.createUser.bind(crmController));

// ============ TAGS ============
router.get('/tags', authenticateToken, crmController.getTags.bind(crmController));
router.post('/tags', authenticateToken, requireRole(['admin', 'supervisor']), crmController.createTag.bind(crmController));

// ============ WEBHOOKS ============
router.post('/webhook/message', crmController.handleIncomingMessage.bind(crmController));

// ============ MÉTRICAS Y ESTADÍSTICAS ============
router.get('/metrics/realtime', authenticateToken, crmController.getRealTimeMetrics.bind(crmController));
router.get('/stats/conversations', authenticateToken, crmController.getConversationStats.bind(crmController));
router.get('/stats/agents', authenticateToken, crmController.getAgentStats.bind(crmController));
router.get('/stats/messages', authenticateToken, crmController.getMessageStats.bind(crmController));

// ============ AGENTES ============
router.get('/agents', authenticateToken, crmController.getAgents.bind(crmController));

// ============ CONFIGURACIÓN DEL SISTEMA ============
router.get('/settings', authenticateToken, requireRole(['admin', 'supervisor']), crmController.getSystemSettings.bind(crmController));
router.post('/settings', authenticateToken, requireRole(['admin']), crmController.updateSystemSettings.bind(crmController));

export default router;

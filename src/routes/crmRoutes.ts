import { Router } from 'express';
import { CRMController } from '../controllers/CRMController';

const router = Router();
const crmController = new CRMController();

/**
 * Rutas para integración con CRM y handovers de agentes
 */

// Endpoint para recibir notificaciones de handover desde el CRM
router.post('/handover', crmController.handleHandover.bind(crmController));

// Endpoint para que el CRM envíe mensajes al usuario a través del bot
router.post('/send-message', crmController.sendMessageFromAgent.bind(crmController));

// Endpoint para obtener el estado de un handover
router.get('/handover-status/:ticketId', crmController.getHandoverStatus.bind(crmController));

// Endpoint para webhook de Meta cuando se transfiere control
router.post('/meta-handover-webhook', crmController.handleMetaHandoverWebhook.bind(crmController));

export default router;

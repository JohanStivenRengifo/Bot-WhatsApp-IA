import express from 'express';
import { WebhookController } from '../controllers';

const router = express.Router();
const webhookController = new WebhookController();

// Webhook verification
router.get('/webhook', webhookController.verifyWebhook.bind(webhookController));

// Webhook handler
router.post('/webhook', webhookController.handleWebhook.bind(webhookController));

// Health check
router.get('/health', webhookController.healthCheck.bind(webhookController));

export default router;
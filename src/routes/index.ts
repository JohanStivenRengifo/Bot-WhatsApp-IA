import express from 'express';
import webhookRoutes from './webhookRoutes';
import crmRoutesMongoDB from './crmRoutesMongoDB';
import diagnosticRoutes from './diagnosticRoutes';
import botControlRoutes from './botControlRoutes';

const router = express.Router();

router.use('/', webhookRoutes);
router.use('/api/crm', crmRoutesMongoDB);
router.use('/api/diagnostics', diagnosticRoutes);
router.use('/api/bot', botControlRoutes);

export default router;
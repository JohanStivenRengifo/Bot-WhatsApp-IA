import express from 'express';
import webhookRoutes from './webhookRoutes';
import crmRoutesMongoDB from './crmRoutesMongoDB';
import diagnosticRoutes from './diagnosticRoutes';

const router = express.Router();

router.use('/', webhookRoutes);
router.use('/api/crm', crmRoutesMongoDB);
router.use('/api/diagnostics', diagnosticRoutes);

export default router;
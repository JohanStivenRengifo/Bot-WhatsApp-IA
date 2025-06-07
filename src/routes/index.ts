import express from 'express';
import webhookRoutes from './webhookRoutes';
import crmRoutes from './crmRoutes';
import diagnosticRoutes from './diagnosticRoutes';

const router = express.Router();

router.use('/', webhookRoutes);
router.use('/api/crm', crmRoutes);
router.use('/api/diagnostics', diagnosticRoutes);

export default router;
import express from 'express';
import webhookRoutes from './webhookRoutes';
import crmRoutes from './crmRoutes';

const router = express.Router();

router.use('/', webhookRoutes);
router.use('/api/crm', crmRoutes);

export default router;
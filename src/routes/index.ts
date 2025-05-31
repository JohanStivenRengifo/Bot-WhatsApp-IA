import express from 'express';
import webhookRoutes from './webhookRoutes';

const router = express.Router();

router.use('/', webhookRoutes);

export default router;
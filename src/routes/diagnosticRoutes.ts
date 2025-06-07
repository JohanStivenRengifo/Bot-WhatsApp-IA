import express from 'express';
import { DiagnosticService } from '../services/DiagnosticService';

const router = express.Router();
const diagnosticService = new DiagnosticService();

/**
 * @route GET /api/diagnostics/status
 * @desc Verifica el estado de todos los servicios de integración
 * @access Private
 */
router.get('/status', async (req, res) => {
    try {
        const result = await diagnosticService.runFullDiagnostic();

        // Determinar el código de estado HTTP según el resultado
        let statusCode = 200;
        if (result.overallStatus === 'error') {
            statusCode = 500;
        } else if (result.overallStatus === 'partial') {
            statusCode = 207; // Multi-Status
        }

        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Error al ejecutar diagnóstico:', error);
        res.status(500).json({
            error: 'Error interno al ejecutar diagnóstico',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/diagnostics/wisphub
 * @desc Verifica específicamente la conexión a WispHub
 * @access Private
 */
router.get('/wisphub', async (req, res) => {
    try {
        const result = await diagnosticService.checkWispHubConnection();

        const statusCode = result.status === 'ok' ? 200 : 500;
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Error al verificar WispHub:', error);
        res.status(500).json({
            error: 'Error interno al verificar WispHub',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/diagnostics/meta
 * @desc Verifica específicamente la conexión a Meta API
 * @access Private
 */
router.get('/meta', async (req, res) => {
    try {
        const result = await diagnosticService.checkMetaConnection();

        const statusCode = result.status === 'ok' ? 200 : 500;
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Error al verificar Meta API:', error);
        res.status(500).json({
            error: 'Error interno al verificar Meta API',
            timestamp: new Date().toISOString()
        });
    }
});

export default router;

import { Request, Response } from 'express';
import { MessageHandler } from './MessageHandler';
import { MessageService } from '../services/MessageService';
import { BotStateService } from '../services/BotStateService';

/**
 * Controlador para gestión y control del bot WhatsApp
 */
export class BotControlController {
    private messageHandler: MessageHandler;
    private messageService: MessageService;
    private botStateService: BotStateService;

    constructor() {
        this.messageHandler = MessageHandler.getInstance();
        this.messageService = MessageService.getInstance();
        this.botStateService = BotStateService.getInstance();
    }

    /**
     * Obtener estado general del bot
     * GET /api/bot/status
     */
    async getBotStatus(req: Request, res: Response): Promise<void> {
        try {
            const metrics = this.botStateService.getMetrics();

            res.json({
                success: true,
                data: {
                    status: this.botStateService.getBotStatus(),
                    uptime: metrics.uptime,
                    uptimeFormatted: this.formatUptime(metrics.uptime),
                    lastActivity: metrics.lastActivity,
                    messagesProcessed: metrics.messagesProcessed,
                    errorsCount: metrics.errorsCount,
                    enabledFlows: this.botStateService.getEnabledFlows(),
                    version: process.env.npm_package_version || '1.0.0',
                    environment: process.env.NODE_ENV || 'development'
                }
            });
        } catch (error) {
            console.error('Error obteniendo estado del bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo estado del bot'
            });
        }
    }

    /**
     * Verificar salud del bot
     * GET /api/bot/health
     */
    async getBotHealth(req: Request, res: Response): Promise<void> {
        try {
            const health = {
                bot: this.botStateService.getBotStatus() === 'running' ? 'healthy' : 'unhealthy',
                messageService: 'healthy', // TODO: Implementar check real
                database: 'healthy', // TODO: Implementar check real
                whatsappApi: 'healthy', // TODO: Implementar check real
                timestamp: new Date().toISOString()
            };

            const overallHealthy = Object.values(health).every(status =>
                status === 'healthy' || status === health.timestamp
            );

            res.status(overallHealthy ? 200 : 503).json({
                success: overallHealthy,
                data: health
            });
        } catch (error) {
            console.error('Error verificando salud del bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error verificando salud del bot'
            });
        }
    }

    /**
     * Pausar el bot
     * POST /api/bot/pause
     */
    async pauseBot(req: Request, res: Response): Promise<void> {
        try {
            const { reason } = req.body;

            this.botStateService.setBotStatus('paused');
            this.botStateService.addLog('info', `Bot pausado. Razón: ${reason || 'Manual'}`);

            res.json({
                success: true,
                message: 'Bot pausado correctamente',
                data: {
                    status: this.botStateService.getBotStatus(),
                    reason: reason || 'Manual',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error pausando bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error pausando bot'
            });
        }
    }

    /**
     * Reanudar el bot
     * POST /api/bot/resume
     */
    async resumeBot(req: Request, res: Response): Promise<void> {
        try {
            this.botStateService.setBotStatus('running');
            this.botStateService.addLog('info', 'Bot reanudado');

            res.json({
                success: true,
                message: 'Bot reanudado correctamente',
                data: {
                    status: this.botStateService.getBotStatus(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error reanudando bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error reanudando bot'
            });
        }
    }

    /**
     * Reiniciar el bot
     * POST /api/bot/restart
     */
    async restartBot(req: Request, res: Response): Promise<void> {
        try {
            this.botStateService.addLog('info', 'Bot reiniciando...');

            // Reiniciar métricas
            this.botStateService.resetMetrics();
            this.botStateService.setBotStatus('running');

            res.json({
                success: true,
                message: 'Bot reiniciado correctamente',
                data: {
                    status: this.botStateService.getBotStatus(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error reiniciando bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error reiniciando bot'
            });
        }
    }

    /**
     * Obtener configuración del bot
     * GET /api/bot/config
     */
    async getBotConfig(req: Request, res: Response): Promise<void> {
        try {
            const config = {
                whatsappToken: process.env.WHATSAPP_TOKEN ? '***CONFIGURED***' : 'NOT_SET',
                phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'NOT_SET',
                webhookUrl: process.env.WEBHOOK_URL || 'NOT_SET',
                apiUrl: process.env.API_URL || 'NOT_SET',
                enabledFlows: this.botStateService.getEnabledFlows(),
                rateLimitEnabled: true, // TODO: Obtener de configuración real
                maintenanceMode: this.botStateService.isInMaintenanceMode(),
                logLevel: process.env.LOG_LEVEL || 'info',
                environment: process.env.NODE_ENV || 'development'
            };

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            console.error('Error obteniendo configuración del bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo configuración del bot'
            });
        }
    }

    /**
     * Actualizar configuración del bot
     * POST /api/bot/config
     */
    async updateBotConfig(req: Request, res: Response): Promise<void> {
        try {
            const { config } = req.body;

            // TODO: Implementar actualización real de configuración
            // Por ahora solo actualizamos los flujos habilitados
            if (config.enabledFlows && Array.isArray(config.enabledFlows)) {
                // Deshabilitar todos los flujos primero
                const currentFlows = this.botStateService.getEnabledFlows();
                currentFlows.forEach(flow => this.botStateService.disableFlow(flow));

                // Habilitar los flujos especificados
                config.enabledFlows.forEach((flow: string) => {
                    this.botStateService.enableFlow(flow);
                });
            }

            this.botStateService.addLog('info', 'Configuración del bot actualizada');

            res.json({
                success: true,
                message: 'Configuración actualizada correctamente',
                data: {
                    enabledFlows: this.botStateService.getEnabledFlows(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error actualizando configuración del bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error actualizando configuración del bot'
            });
        }
    }

    /**
     * Obtener flujos disponibles
     * GET /api/bot/flows
     */
    async getAvailableFlows(req: Request, res: Response): Promise<void> {
        try {
            const availableFlows = [
                { name: 'initialSelection', description: 'Selección inicial (Ventas/Soporte)', enabled: this.botStateService.isFlowEnabled('initialSelection') },
                { name: 'authentication', description: 'Autenticación de usuarios', enabled: this.botStateService.isFlowEnabled('authentication') },
                { name: 'sales', description: 'Flujo de ventas', enabled: this.botStateService.isFlowEnabled('sales') },
                { name: 'clientMenu', description: 'Menú de cliente autenticado', enabled: this.botStateService.isFlowEnabled('clientMenu') },
                { name: 'agentHandover', description: 'Transferencia a agente humano', enabled: this.botStateService.isFlowEnabled('agentHandover') },
                { name: 'ticketCreation', description: 'Creación de tickets', enabled: this.botStateService.isFlowEnabled('ticketCreation') },
                { name: 'invoices', description: 'Consulta de facturas', enabled: this.botStateService.isFlowEnabled('invoices') },
                { name: 'passwordChange', description: 'Cambio de contraseña', enabled: this.botStateService.isFlowEnabled('passwordChange') },
                { name: 'planUpgrade', description: 'Mejora de plan', enabled: this.botStateService.isFlowEnabled('planUpgrade') },
                { name: 'paymentReceipt', description: 'Validación de pagos', enabled: this.botStateService.isFlowEnabled('paymentReceipt') },
                { name: 'debtInquiry', description: 'Consulta de deudas', enabled: this.botStateService.isFlowEnabled('debtInquiry') },
                { name: 'logout', description: 'Cerrar sesión', enabled: this.botStateService.isFlowEnabled('logout') },
                { name: 'suspendedService', description: 'Servicio suspendido', enabled: this.botStateService.isFlowEnabled('suspendedService') }
            ];

            res.json({
                success: true,
                data: {
                    flows: availableFlows
                }
            });
        } catch (error) {
            console.error('Error obteniendo flujos disponibles:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo flujos disponibles'
            });
        }
    }

    /**
     * Habilitar un flujo específico
     * POST /api/bot/flows/:flowName/enable
     */
    async enableFlow(req: Request, res: Response): Promise<void> {
        try {
            const { flowName } = req.params;

            this.botStateService.enableFlow(flowName);
            this.botStateService.addLog('info', `Flujo '${flowName}' habilitado`);

            res.json({
                success: true,
                message: `Flujo '${flowName}' habilitado correctamente`,
                data: {
                    flowName,
                    enabled: true,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error habilitando flujo:', error);
            res.status(500).json({
                success: false,
                error: 'Error habilitando flujo'
            });
        }
    }

    /**
     * Deshabilitar un flujo específico
     * POST /api/bot/flows/:flowName/disable
     */
    async disableFlow(req: Request, res: Response): Promise<void> {
        try {
            const { flowName } = req.params;

            this.botStateService.disableFlow(flowName);
            this.botStateService.addLog('info', `Flujo '${flowName}' deshabilitado`);

            res.json({
                success: true,
                message: `Flujo '${flowName}' deshabilitado correctamente`,
                data: {
                    flowName,
                    enabled: false,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error deshabilitando flujo:', error);
            res.status(500).json({
                success: false,
                error: 'Error deshabilitando flujo'
            });
        }
    }    /**
     * Obtener sesiones activas
     * GET /api/bot/sessions
     */
    async getActiveSessions(req: Request, res: Response): Promise<void> {
        try {
            // TODO: Implementar obtención de sesiones reales
            const sessions: Array<{
                phoneNumber: string;
                startTime: string;
                lastActivity: string;
                currentFlow: string;
                botPaused: boolean;
            }> = [];

            res.json({
                success: true,
                data: {
                    sessions
                }
            });
        } catch (error) {
            console.error('Error obteniendo sesiones activas:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo sesiones activas'
            });
        }
    }

    /**
     * Limpiar sesión de usuario
     * DELETE /api/bot/sessions/:phoneNumber
     */
    async clearUserSession(req: Request, res: Response): Promise<void> {
        try {
            const { phoneNumber } = req.params;

            // TODO: Implementar limpieza real de sesión
            this.botStateService.addLog('info', `Sesión limpiada para: ${phoneNumber}`);

            res.json({
                success: true,
                message: `Sesión de ${phoneNumber} limpiada correctamente`,
                data: {
                    phoneNumber,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error limpiando sesión:', error);
            res.status(500).json({
                success: false,
                error: 'Error limpiando sesión'
            });
        }
    }

    /**
     * Limpiar todas las sesiones
     * DELETE /api/bot/sessions
     */
    async clearAllSessions(req: Request, res: Response): Promise<void> {
        try {
            // TODO: Implementar limpieza real de todas las sesiones
            this.botStateService.addLog('info', 'Todas las sesiones han sido limpiadas');

            res.json({
                success: true,
                message: 'Todas las sesiones han sido limpiadas correctamente',
                data: {
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error limpiando todas las sesiones:', error);
            res.status(500).json({
                success: false,
                error: 'Error limpiando todas las sesiones'
            });
        }
    }

    /**
     * Obtener métricas de mensajes
     * GET /api/bot/metrics/messages
     */
    async getMessageMetrics(req: Request, res: Response): Promise<void> {
        try {
            const metrics = this.botStateService.getMetrics();

            res.json({
                success: true,
                data: {
                    totalProcessed: metrics.messagesProcessed,
                    totalErrors: metrics.errorsCount,
                    averageResponseTime: 1200, // TODO: Calcular tiempo real
                    uptime: metrics.uptime,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error obteniendo métricas de mensajes:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo métricas de mensajes'
            });
        }
    }

    /**
     * Obtener métricas de flujos
     * GET /api/bot/metrics/flows
     */
    async getFlowMetrics(req: Request, res: Response): Promise<void> {
        try {
            // TODO: Implementar métricas reales de flujos
            const flowMetrics = {
                initialSelection: { executions: 0, errors: 0 },
                authentication: { executions: 0, errors: 0 },
                sales: { executions: 0, errors: 0 },
                clientMenu: { executions: 0, errors: 0 }
            };

            res.json({
                success: true,
                data: flowMetrics
            });
        } catch (error) {
            console.error('Error obteniendo métricas de flujos:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo métricas de flujos'
            });
        }
    }

    /**
     * Obtener métricas de errores
     * GET /api/bot/metrics/errors
     */
    async getErrorMetrics(req: Request, res: Response): Promise<void> {
        try {
            const metrics = this.botStateService.getMetrics();

            res.json({
                success: true,
                data: {
                    totalErrors: metrics.errorsCount,
                    errorRate: metrics.messagesProcessed > 0 ? (metrics.errorsCount / metrics.messagesProcessed) * 100 : 0,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error obteniendo métricas de errores:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo métricas de errores'
            });
        }
    }

    /**
     * Obtener logs del bot
     * GET /api/bot/logs
     */
    async getBotLogs(req: Request, res: Response): Promise<void> {
        try {
            const { level, limit } = req.query;
            let logs = this.botStateService.getLogs();

            // Filtrar por nivel si se especifica
            if (level) {
                logs = logs.filter(log => log.level === level);
            }

            // Limitar cantidad si se especifica
            if (limit) {
                const limitNum = parseInt(limit as string);
                logs = logs.slice(-limitNum);
            }

            res.json({
                success: true,
                data: {
                    logs: logs.map(log => ({
                        timestamp: log.timestamp.toISOString(),
                        level: log.level,
                        message: log.message
                    }))
                }
            });
        } catch (error) {
            console.error('Error obteniendo logs del bot:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo logs del bot'
            });
        }
    }

    /**
     * Obtener logs de errores
     * GET /api/bot/logs/errors
     */
    async getErrorLogs(req: Request, res: Response): Promise<void> {
        try {
            const logs = this.botStateService.getLogs()
                .filter(log => log.level === 'error')
                .slice(-50); // Últimos 50 errores

            res.json({
                success: true,
                data: {
                    logs: logs.map(log => ({
                        timestamp: log.timestamp.toISOString(),
                        level: log.level,
                        message: log.message
                    }))
                }
            });
        } catch (error) {
            console.error('Error obteniendo logs de errores:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo logs de errores'
            });
        }
    }

    /**
     * Habilitar modo mantenimiento
     * POST /api/bot/maintenance/enable
     */
    async enableMaintenanceMode(req: Request, res: Response): Promise<void> {
        try {
            const { message } = req.body;

            this.botStateService.setBotStatus('maintenance');
            this.botStateService.setMaintenanceMessage(message || '');
            this.botStateService.addLog('info', 'Modo mantenimiento habilitado');

            res.json({
                success: true,
                message: 'Modo mantenimiento habilitado correctamente',
                data: {
                    status: this.botStateService.getBotStatus(),
                    maintenanceMessage: this.botStateService.getMaintenanceMessage(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error habilitando modo mantenimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error habilitando modo mantenimiento'
            });
        }
    }

    /**
     * Deshabilitar modo mantenimiento
     * POST /api/bot/maintenance/disable
     */
    async disableMaintenanceMode(req: Request, res: Response): Promise<void> {
        try {
            this.botStateService.setBotStatus('running');
            this.botStateService.setMaintenanceMessage('');
            this.botStateService.addLog('info', 'Modo mantenimiento deshabilitado');

            res.json({
                success: true,
                message: 'Modo mantenimiento deshabilitado correctamente',
                data: {
                    status: this.botStateService.getBotStatus(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error deshabilitando modo mantenimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error deshabilitando modo mantenimiento'
            });
        }
    }

    /**
     * Obtener estado del mantenimiento
     * GET /api/bot/maintenance/status
     */
    async getMaintenanceStatus(req: Request, res: Response): Promise<void> {
        try {
            res.json({
                success: true,
                data: {
                    maintenanceMode: this.botStateService.isInMaintenanceMode(),
                    message: this.botStateService.getMaintenanceMessage(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error obteniendo estado del mantenimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo estado del mantenimiento'
            });
        }
    }

    /**
     * Formatea el tiempo de actividad en un formato legible
     */
    private formatUptime(uptimeMs: number): string {
        const seconds = Math.floor(uptimeMs / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

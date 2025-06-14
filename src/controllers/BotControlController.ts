import { Request, Response } from 'express';
import { MessageHandler } from './MessageHandler';
import { MessageService } from '../services/MessageService';

/**
 * Controlador para gestión y control del bot WhatsApp
 */
export class BotControlController {
    private messageHandler: MessageHandler;
    private messageService: MessageService;

    // Estado del bot
    private static botStatus: 'running' | 'paused' | 'maintenance' | 'error' = 'running';
    private static enabledFlows: Set<string> = new Set();
    private static metrics = {
        messagesProcessed: 0,
        errorsCount: 0,
        startTime: new Date(),
        lastActivity: new Date()
    };
    private static logs: Array<{ timestamp: Date; level: string; message: string; }> = []; constructor() {
        this.messageHandler = MessageHandler.getInstance();
        this.messageService = MessageService.getInstance();

        // Inicializar flujos habilitados por defecto
        BotControlController.enabledFlows.add('initialSelection');
        BotControlController.enabledFlows.add('authentication');
        BotControlController.enabledFlows.add('sales');
        BotControlController.enabledFlows.add('clientMenu');
        BotControlController.enabledFlows.add('agentHandover');
    }

    /**
     * Obtener estado general del bot
     * GET /api/bot/status
     */
    async getBotStatus(req: Request, res: Response): Promise<void> {
        try {
            const uptime = Date.now() - BotControlController.metrics.startTime.getTime();

            res.json({
                success: true,
                data: {
                    status: BotControlController.botStatus,
                    uptime: uptime,
                    uptimeFormatted: this.formatUptime(uptime),
                    lastActivity: BotControlController.metrics.lastActivity,
                    messagesProcessed: BotControlController.metrics.messagesProcessed,
                    errorsCount: BotControlController.metrics.errorsCount,
                    enabledFlows: Array.from(BotControlController.enabledFlows),
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
                bot: BotControlController.botStatus === 'running' ? 'healthy' : 'unhealthy',
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

            BotControlController.botStatus = 'paused';
            this.addLog('info', `Bot pausado. Razón: ${reason || 'Manual'}`);

            res.json({
                success: true,
                message: 'Bot pausado correctamente',
                data: {
                    status: BotControlController.botStatus,
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
            BotControlController.botStatus = 'running';
            this.addLog('info', 'Bot reanudado');

            res.json({
                success: true,
                message: 'Bot reanudado correctamente',
                data: {
                    status: BotControlController.botStatus,
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
            this.addLog('info', 'Bot reiniciando...');

            // Reiniciar métricas
            BotControlController.metrics = {
                messagesProcessed: 0,
                errorsCount: 0,
                startTime: new Date(),
                lastActivity: new Date()
            };

            BotControlController.botStatus = 'running';

            res.json({
                success: true,
                message: 'Bot reiniciado correctamente',
                data: {
                    status: BotControlController.botStatus,
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
                enabledFlows: Array.from(BotControlController.enabledFlows),
                rateLimitEnabled: true, // TODO: Obtener de configuración real
                maintenanceMode: BotControlController.botStatus === 'maintenance',
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
                BotControlController.enabledFlows.clear();
                config.enabledFlows.forEach((flow: string) => {
                    BotControlController.enabledFlows.add(flow);
                });
            }

            this.addLog('info', 'Configuración del bot actualizada');

            res.json({
                success: true,
                message: 'Configuración actualizada correctamente',
                data: {
                    enabledFlows: Array.from(BotControlController.enabledFlows),
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
                { name: 'initialSelection', description: 'Selección inicial (Ventas/Soporte)', enabled: BotControlController.enabledFlows.has('initialSelection') },
                { name: 'authentication', description: 'Autenticación de usuarios', enabled: BotControlController.enabledFlows.has('authentication') },
                { name: 'sales', description: 'Flujo de ventas', enabled: BotControlController.enabledFlows.has('sales') },
                { name: 'clientMenu', description: 'Menú de cliente autenticado', enabled: BotControlController.enabledFlows.has('clientMenu') },
                { name: 'agentHandover', description: 'Transferencia a agente humano', enabled: BotControlController.enabledFlows.has('agentHandover') },
                { name: 'ticketCreation', description: 'Creación de tickets', enabled: BotControlController.enabledFlows.has('ticketCreation') },
                { name: 'invoices', description: 'Consulta de facturas', enabled: BotControlController.enabledFlows.has('invoices') },
                { name: 'passwordChange', description: 'Cambio de contraseña', enabled: BotControlController.enabledFlows.has('passwordChange') },
                { name: 'planUpgrade', description: 'Mejora de plan', enabled: BotControlController.enabledFlows.has('planUpgrade') },
                { name: 'paymentReceipt', description: 'Validación de pagos', enabled: BotControlController.enabledFlows.has('paymentReceipt') },
                { name: 'simplifiedUX', description: 'UX simplificada para usuarios rurales', enabled: BotControlController.enabledFlows.has('simplifiedUX') }
            ];

            res.json({
                success: true,
                data: availableFlows
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

            BotControlController.enabledFlows.add(flowName);
            this.addLog('info', `Flujo '${flowName}' habilitado`);

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

            BotControlController.enabledFlows.delete(flowName);
            this.addLog('info', `Flujo '${flowName}' deshabilitado`);

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
    }

    /**
     * Obtener sesiones activas
     * GET /api/bot/sessions
     */
    async getActiveSessions(req: Request, res: Response): Promise<void> {
        try {
            // TODO: Implementar obtención real de sesiones activas
            const mockSessions = [
                {
                    phoneNumber: '+57300000001',
                    authenticated: true,
                    flowActive: 'clientMenu',
                    lastActivity: new Date(),
                    sessionDuration: 1800000 // 30 min
                }
            ];

            res.json({
                success: true,
                data: {
                    totalSessions: mockSessions.length,
                    sessions: mockSessions
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
     * Limpiar sesión de usuario específico
     * DELETE /api/bot/sessions/:phoneNumber
     */
    async clearUserSession(req: Request, res: Response): Promise<void> {
        try {
            const { phoneNumber } = req.params;

            // TODO: Implementar limpieza real de sesión
            this.addLog('info', `Sesión limpiada para usuario: ${phoneNumber}`);

            res.json({
                success: true,
                message: `Sesión del usuario ${phoneNumber} limpiada correctamente`,
                data: {
                    phoneNumber,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error limpiando sesión de usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error limpiando sesión de usuario'
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
            this.addLog('info', 'Todas las sesiones han sido limpiadas');

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
            const metrics = {
                totalProcessed: BotControlController.metrics.messagesProcessed,
                totalErrors: BotControlController.metrics.errorsCount,
                successRate: BotControlController.metrics.messagesProcessed > 0
                    ? ((BotControlController.metrics.messagesProcessed - BotControlController.metrics.errorsCount) / BotControlController.metrics.messagesProcessed * 100).toFixed(2)
                    : '100.00',
                averageResponseTime: '1.2s', // TODO: Implementar cálculo real
                messagesPerMinute: this.calculateMessagesPerMinute(),
                lastActivity: BotControlController.metrics.lastActivity
            };

            res.json({
                success: true,
                data: metrics
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
            const flowMetrics = [
                { flowName: 'sales', usage: 45, avgDuration: '3m 20s' },
                { flowName: 'authentication', usage: 32, avgDuration: '1m 15s' },
                { flowName: 'agentHandover', usage: 18, avgDuration: '45s' },
                { flowName: 'clientMenu', usage: 28, avgDuration: '2m 10s' }
            ];

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
            const errorMetrics = {
                totalErrors: BotControlController.metrics.errorsCount,
                errorRate: BotControlController.metrics.messagesProcessed > 0
                    ? (BotControlController.metrics.errorsCount / BotControlController.metrics.messagesProcessed * 100).toFixed(2)
                    : '0.00',
                commonErrors: [
                    { type: 'Authentication Failed', count: 5 },
                    { type: 'Flow Processing Error', count: 3 },
                    { type: 'Rate Limit Exceeded', count: 2 }
                ]
            };

            res.json({
                success: true,
                data: errorMetrics
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
            const { limit = 100, level } = req.query;

            let logs = BotControlController.logs;

            if (level) {
                logs = logs.filter(log => log.level === level);
            }

            logs = logs.slice(-parseInt(limit as string));

            res.json({
                success: true,
                data: {
                    total: logs.length,
                    logs: logs
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
            const errorLogs = BotControlController.logs.filter(log => log.level === 'error');

            res.json({
                success: true,
                data: {
                    total: errorLogs.length,
                    logs: errorLogs.slice(-50) // Últimos 50 errores
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

            BotControlController.botStatus = 'maintenance';
            this.addLog('info', `Modo mantenimiento habilitado. Mensaje: ${message || 'Sin mensaje personalizado'}`);

            res.json({
                success: true,
                message: 'Modo mantenimiento habilitado',
                data: {
                    status: BotControlController.botStatus,
                    maintenanceMessage: message,
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
            BotControlController.botStatus = 'running';
            this.addLog('info', 'Modo mantenimiento deshabilitado');

            res.json({
                success: true,
                message: 'Modo mantenimiento deshabilitado',
                data: {
                    status: BotControlController.botStatus,
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
     * Obtener estado del modo mantenimiento
     * GET /api/bot/maintenance/status
     */
    async getMaintenanceStatus(req: Request, res: Response): Promise<void> {
        try {
            res.json({
                success: true,
                data: {
                    maintenanceMode: BotControlController.botStatus === 'maintenance',
                    status: BotControlController.botStatus,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error obteniendo estado de mantenimiento:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo estado de mantenimiento'
            });
        }
    }

    // ============ MÉTODOS UTILITARIOS ============

    /**
     * Formatear tiempo de actividad
     */
    private formatUptime(uptime: number): string {
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m ${seconds % 60}s`;
        }
    }

    /**
     * Calcular mensajes por minuto
     */
    private calculateMessagesPerMinute(): number {
        const uptimeMinutes = (Date.now() - BotControlController.metrics.startTime.getTime()) / (1000 * 60);
        return uptimeMinutes > 0 ? Math.round(BotControlController.metrics.messagesProcessed / uptimeMinutes) : 0;
    }

    /**
     * Agregar log
     */
    private addLog(level: string, message: string): void {
        BotControlController.logs.push({
            timestamp: new Date(),
            level,
            message
        });

        // Mantener solo los últimos 1000 logs
        if (BotControlController.logs.length > 1000) {
            BotControlController.logs = BotControlController.logs.slice(-1000);
        }
    }

    // ============ MÉTODOS ESTÁTICOS PARA USO INTERNO ============

    /**
     * Incrementar contador de mensajes procesados
     */
    static incrementMessageCount(): void {
        BotControlController.metrics.messagesProcessed++;
        BotControlController.metrics.lastActivity = new Date();
    }

    /**
     * Incrementar contador de errores
     */
    static incrementErrorCount(): void {
        BotControlController.metrics.errorsCount++;
    }

    /**
     * Verificar si el bot está activo
     */
    static isBotActive(): boolean {
        return BotControlController.botStatus === 'running';
    }

    /**
     * Verificar si un flujo está habilitado
     */
    static isFlowEnabled(flowName: string): boolean {
        return BotControlController.enabledFlows.has(flowName);
    }

    /**
     * Obtener estado actual del bot
     */
    static getCurrentStatus(): string {
        return BotControlController.botStatus;
    }
}

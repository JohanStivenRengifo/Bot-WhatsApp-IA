import { MessageService } from './MessageService';

export interface Alert {
    id: string;
    type: 'error' | 'warning' | 'info' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
    context?: any;
}

export interface NotificationConfig {
    adminPhones: string[];
    emailAlerts: boolean;
    webhookUrl?: string;
    alertThresholds: {
        errorRate: number;
        responseTime: number;
        memoryUsage: number;
    };
}

/**
 * Sistema de notificaciones y alertas para administradores
 */
export class NotificationService {
    private static instance: NotificationService;
    private messageService: MessageService;
    private config!: NotificationConfig;
    private activeAlerts: Map<string, Alert> = new Map();
    private alertHistory: Alert[] = [];

    private constructor() {
        this.messageService = MessageService.getInstance();
        this.loadConfig();
        this.startMonitoring();
    }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    private loadConfig(): void {
        this.config = {
            adminPhones: process.env.ADMIN_PHONES?.split(',') || [],
            emailAlerts: process.env.EMAIL_ALERTS === 'true',
            webhookUrl: process.env.ALERT_WEBHOOK_URL,
            alertThresholds: {
                errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '10'),
                responseTime: parseFloat(process.env.RESPONSE_TIME_THRESHOLD || '5000'),
                memoryUsage: parseFloat(process.env.MEMORY_THRESHOLD || '80')
            }
        };
    }

    /**
     * Envía una alerta crítica
     */
    async sendCriticalAlert(message: string, context?: any): Promise<void> {
        const alert: Alert = {
            id: this.generateAlertId(),
            type: 'critical',
            message,
            timestamp: new Date(),
            resolved: false,
            context
        };

        await this.processAlert(alert);
    }

    /**
     * Envía alerta de error
     */
    async sendErrorAlert(error: Error, context?: any): Promise<void> {
        const alert: Alert = {
            id: this.generateAlertId(),
            type: 'error',
            message: `Error: ${error.message}`,
            timestamp: new Date(),
            resolved: false,
            context: { ...context, stack: error.stack }
        };

        await this.processAlert(alert);
    }

    /**
     * Envía notificación de advertencia
     */
    async sendWarning(message: string, context?: any): Promise<void> {
        const alert: Alert = {
            id: this.generateAlertId(),
            type: 'warning',
            message,
            timestamp: new Date(),
            resolved: false,
            context
        };

        await this.processAlert(alert);
    }

    /**
     * Notifica sobre alta carga del sistema
     */
    async notifyHighLoad(metrics: any): Promise<void> {
        const message = `🚨 ALTA CARGA DEL SISTEMA
        
📊 Métricas actuales:
• CPU: ${metrics.cpu || 'N/A'}%
• Memoria: ${metrics.memory || 'N/A'}MB
• Usuarios activos: ${metrics.activeUsers || 0}
• Errores/hora: ${metrics.errorsPerHour || 0}

⚡ Acciones recomendadas:
• Verificar logs del sistema
• Considerar escalamiento
• Monitorear rendimiento`;

        await this.sendCriticalAlert(message, metrics);
    }

    /**
     * Notifica sobre errores de integración
     */
    async notifyIntegrationError(service: string, error: Error): Promise<void> {
        const message = `🔌 ERROR DE INTEGRACIÓN
        
❌ Servicio: ${service}
🕐 Tiempo: ${new Date().toLocaleString()}
📝 Error: ${error.message}

🔧 Verificar:
• Conectividad de red
• Credenciales de API
• Estado del servicio externo`;

        await this.sendErrorAlert(error, { service, timestamp: new Date() });
    }

    /**
     * Notifica a agentes sobre transferencia de conversación (handover)
     */
    async sendHandoverAlert(
        phoneNumber: string,
        customerName: string,
        reason: string,
        priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
        context?: any
    ): Promise<void> {
        const priorityEmoji = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            urgent: '🔴'
        };

        const message = `${priorityEmoji[priority]} **TRANSFERENCIA A AGENTE**

👤 **Cliente:** ${customerName}
📱 **Teléfono:** ${phoneNumber}
🔄 **Motivo:** ${reason}
📋 **Prioridad:** ${priority.toUpperCase()}
🕐 **Hora:** ${new Date().toLocaleString()}

${context?.lastMessages ?
                `📝 **Últimos mensajes:**
${context.lastMessages.slice(-3).map((msg: any) =>
                    `• ${msg.from === 'bot' ? '🤖' : '👤'} ${msg.text}`).join('\n')}`
                : ''}

${context?.userData ?
                `📊 **Información del cliente:**
• Conversaciones previas: ${context.userData.totalConversations || 0}
• Último contacto: ${context.userData.lastContact || 'Primera vez'}
• Estado: ${context.userData.status || 'Activo'}`
                : ''}

⚡ **Acciones necesarias:**
• Responder al cliente en máximo 3 minutos
• Revisar historial de conversación
• Actualizar estado en CRM`;

        // Crear alerta de tipo info para handover
        const alert: Alert = {
            id: this.generateAlertId(),
            type: priority === 'urgent' ? 'critical' : 'info',
            message: `Handover solicitado para ${customerName} (${phoneNumber}): ${reason}`,
            timestamp: new Date(),
            resolved: false,
            context: {
                phoneNumber,
                customerName,
                reason,
                priority,
                type: 'handover',
                ...context
            }
        };

        await this.processAlert(alert);

        // También enviar notificación específica a agentes disponibles
        await this.notifyAvailableAgents(message, alert);
    }

    /**
     * Notifica a agentes disponibles sobre handover
     */
    private async notifyAvailableAgents(message: string, alert: Alert): Promise<void> {
        // Obtener lista de agentes disponibles desde variables de entorno
        const agentPhones = process.env.CRM_AGENT_PHONES?.split(',') || [];

        if (agentPhones.length === 0) {
            console.warn('⚠️ No hay agentes configurados para recibir notificaciones de handover');
            return;
        }

        for (const agentPhone of agentPhones) {
            try {
                await this.messageService.sendTextMessage(agentPhone.trim(), message);
                console.log(`📧 Notificación de handover enviada a agente: ${agentPhone}`);
            } catch (error) {
                console.error(`Error enviando notificación de handover a agente ${agentPhone}:`, error);
            }
        }
    }

    /**
     * Notifica resolución de handover
     */
    async sendHandoverResolution(
        phoneNumber: string,
        customerName: string,
        agentName: string,
        resolutionTime: number,
        summary?: string
    ): Promise<void> {
        const message = `✅ **HANDOVER RESUELTO**

👤 **Cliente:** ${customerName}
📱 **Teléfono:** ${phoneNumber}
👨‍💼 **Agente:** ${agentName}
⏱️ **Tiempo de resolución:** ${Math.round(resolutionTime / 60)} minutos
🕐 **Finalizado:** ${new Date().toLocaleString()}

${summary ? `📝 **Resumen:** ${summary}` : ''}

🔄 **Cliente devuelto al bot automático**`;

        // Enviar a administradores y agentes
        const alert: Alert = {
            id: this.generateAlertId(),
            type: 'info',
            message: `Handover resuelto para ${customerName} por ${agentName}`,
            timestamp: new Date(),
            resolved: true,
            context: {
                phoneNumber,
                customerName,
                agentName,
                resolutionTime,
                summary,
                type: 'handover_resolved'
            }
        };

        await this.processAlert(alert);
    }

    /**
     * Procesa y distribuye una alerta
     */
    private async processAlert(alert: Alert): Promise<void> {
        // Almacenar alerta
        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.push(alert);

        // Limitar historial a 1000 entradas
        if (this.alertHistory.length > 1000) {
            this.alertHistory = this.alertHistory.slice(-1000);
        }

        console.error(`🚨 [ALERT] ${alert.type.toUpperCase()}: ${alert.message}`);

        // Enviar a administradores vía WhatsApp
        await this.sendToAdmins(alert);

        // Enviar a webhook si está configurado
        await this.sendToWebhook(alert);
    }

    /**
     * Envía alerta a administradores por WhatsApp
     */
    private async sendToAdmins(alert: Alert): Promise<void> {
        const emoji = this.getAlertEmoji(alert.type);
        const formattedMessage = `${emoji} **ALERTA DEL BOT**

🔸 **Tipo:** ${alert.type.toUpperCase()}
🕐 **Tiempo:** ${alert.timestamp.toLocaleString()}
📝 **Mensaje:** ${alert.message}

🔍 **ID:** ${alert.id}`;

        for (const adminPhone of this.config.adminPhones) {
            try {
                await this.messageService.sendTextMessage(adminPhone, formattedMessage);
            } catch (error) {
                console.error(`Error enviando alerta a admin ${adminPhone}:`, error);
            }
        }
    }

    /**
     * Envía alerta a webhook configurado
     */
    private async sendToWebhook(alert: Alert): Promise<void> {
        if (!this.config.webhookUrl) return;

        try {
            const payload = {
                alert,
                timestamp: new Date().toISOString(),
                source: 'whatsapp-bot'
            };

            // Aquí se implementaría el envío HTTP al webhook
            console.log('📤 Enviando alerta a webhook:', this.config.webhookUrl);
        } catch (error) {
            console.error('Error enviando alerta a webhook:', error);
        }
    }

    /**
     * Resuelve una alerta activa
     */
    resolveAlert(alertId: string): boolean {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.resolved = true;
            this.activeAlerts.delete(alertId);
            console.log(`✅ Alerta ${alertId} resuelta`);
            return true;
        }
        return false;
    }

    /**
     * Obtiene alertas activas
     */
    getActiveAlerts(): Alert[] {
        return Array.from(this.activeAlerts.values());
    }

    /**
     * Obtiene estadísticas de alertas
     */
    getAlertStats(): {
        active: number;
        total: number;
        byType: Record<string, number>;
        last24h: number;
    } {
        const last24h = new Date();
        last24h.setHours(last24h.getHours() - 24);

        const recent = this.alertHistory.filter(a => a.timestamp > last24h);
        const byType = this.alertHistory.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            active: this.activeAlerts.size,
            total: this.alertHistory.length,
            byType,
            last24h: recent.length
        };
    }

    private getAlertEmoji(type: string): string {
        const emojis = {
            critical: '🚨',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return emojis[type as keyof typeof emojis] || '📢';
    }

    private generateAlertId(): string {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    private startMonitoring(): void {
        // Verificar alertas no resueltas cada 5 minutos
        setInterval(() => {
            this.checkUnresolvedAlerts();
        }, 5 * 60 * 1000);

        console.log('📢 NotificationService iniciado');
    }

    private checkUnresolvedAlerts(): void {
        const unresolved = this.getActiveAlerts();
        if (unresolved.length > 10) {
            console.warn(`⚠️ Muchas alertas sin resolver: ${unresolved.length}`);
        }
    }
}

export default NotificationService;

/**
 * Servicio para gestionar el estado global del bot
 * Evita dependencias circulares entre controladores
 */
export class BotStateService {
    private static instance: BotStateService;

    // Estado del bot
    private botStatus: 'running' | 'paused' | 'maintenance' | 'error' = 'running';
    private enabledFlows: Set<string> = new Set();
    private maintenanceMessage: string = '';
    private metrics = {
        messagesProcessed: 0,
        errorsCount: 0,
        startTime: new Date(),
        lastActivity: new Date()
    };
    private logs: Array<{ timestamp: Date; level: string; message: string; }> = [];

    private constructor() {
        // Inicializar flujos habilitados por defecto
        this.enabledFlows.add('initialSelection');
        this.enabledFlows.add('authentication');
        this.enabledFlows.add('sales');
        this.enabledFlows.add('clientMenu');
        this.enabledFlows.add('agentHandover');
        this.enabledFlows.add('ticketCreation');
        this.enabledFlows.add('invoices');
        this.enabledFlows.add('passwordChange');
        this.enabledFlows.add('planUpgrade');
        this.enabledFlows.add('paymentReceipt');
        this.enabledFlows.add('debtInquiry');
        this.enabledFlows.add('logout');
        this.enabledFlows.add('suspendedService');
    }

    public static getInstance(): BotStateService {
        if (!BotStateService.instance) {
            BotStateService.instance = new BotStateService();
        }
        return BotStateService.instance;
    }

    // Getters para el estado del bot
    public getBotStatus(): 'running' | 'paused' | 'maintenance' | 'error' {
        return this.botStatus;
    }

    public isFlowEnabled(flowName: string): boolean {
        return this.enabledFlows.has(flowName);
    }

    public getEnabledFlows(): string[] {
        return Array.from(this.enabledFlows);
    }

    public getMaintenanceMessage(): string {
        return this.maintenanceMessage;
    }

    public getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime.getTime()
        };
    }

    public getLogs(): Array<{ timestamp: Date; level: string; message: string; }> {
        return [...this.logs];
    }

    // Setters para el estado del bot
    public setBotStatus(status: 'running' | 'paused' | 'maintenance' | 'error'): void {
        this.botStatus = status;
        this.addLog('info', `Bot status changed to: ${status}`);
    }

    public enableFlow(flowName: string): void {
        this.enabledFlows.add(flowName);
        this.addLog('info', `Flow enabled: ${flowName}`);
    }

    public disableFlow(flowName: string): void {
        this.enabledFlows.delete(flowName);
        this.addLog('info', `Flow disabled: ${flowName}`);
    }

    public setMaintenanceMessage(message: string): void {
        this.maintenanceMessage = message;
    }

    public incrementMessagesProcessed(): void {
        this.metrics.messagesProcessed++;
        this.metrics.lastActivity = new Date();
    }

    public incrementErrorsCount(): void {
        this.metrics.errorsCount++;
    }

    public resetMetrics(): void {
        this.metrics = {
            messagesProcessed: 0,
            errorsCount: 0,
            startTime: new Date(),
            lastActivity: new Date()
        };
        this.addLog('info', 'Metrics reset');
    }

    public addLog(level: string, message: string): void {
        this.logs.push({
            timestamp: new Date(),
            level,
            message
        });

        // Mantener solo los últimos 1000 logs
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }
    }

    // Métodos de utilidad
    public isBotActive(): boolean {
        return this.botStatus === 'running';
    }

    public isInMaintenanceMode(): boolean {
        return this.botStatus === 'maintenance';
    }

    public canProcessMessages(): boolean {
        return this.botStatus === 'running' || this.botStatus === 'maintenance';
    }

    public getMaintenanceResponse(): string {
        if (this.maintenanceMessage) {
            return `🔧 *Mantenimiento en Curso*\n\n${this.maintenanceMessage}\n\nDisculpa las molestias. Volveremos pronto.`;
        }
        return `🔧 *Mantenimiento en Curso*\n\nNuestro sistema está en mantenimiento temporalmente.\n\nDisculpa las molestias. Volveremos pronto.`;
    }
}

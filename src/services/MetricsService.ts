/**
 * Servicio de métricas y analíticas para el bot
 */
export interface BotMetrics {
    messagesProcessed: number;
    uniqueUsers: number;
    flowsCompleted: {
        sales: number;
        support: number;
        authentication: number;
        invoices: number;
    };
    errorCount: number;
    averageResponseTime: number;
    peakConcurrentUsers: number;
    dailyStats: {
        [date: string]: {
            messages: number;
            users: number;
            errors: number;
        };
    };
}

export class MetricsService {
    private static instance: MetricsService;
    private metrics!: BotMetrics;
    private responseTimeBuffer: number[] = [];
    private currentUsers: Set<string> = new Set();

    private constructor() {
        this.initializeMetrics();
        this.startPeriodicReporting();
    }

    static getInstance(): MetricsService {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService();
        }
        return MetricsService.instance;
    }

    private initializeMetrics(): void {
        this.metrics = {
            messagesProcessed: 0,
            uniqueUsers: 0,
            flowsCompleted: {
                sales: 0,
                support: 0,
                authentication: 0,
                invoices: 0
            },
            errorCount: 0,
            averageResponseTime: 0,
            peakConcurrentUsers: 0,
            dailyStats: {}
        };
    }

    /**
     * Registra un mensaje procesado
     */
    recordMessage(phoneNumber: string, responseTime?: number): void {
        this.metrics.messagesProcessed++;
        this.currentUsers.add(phoneNumber);

        // Actualizar usuarios únicos
        this.metrics.uniqueUsers = this.currentUsers.size;

        // Actualizar pico de usuarios concurrentes
        if (this.currentUsers.size > this.metrics.peakConcurrentUsers) {
            this.metrics.peakConcurrentUsers = this.currentUsers.size;
        }

        // Registrar tiempo de respuesta
        if (responseTime) {
            this.responseTimeBuffer.push(responseTime);
            if (this.responseTimeBuffer.length > 100) {
                this.responseTimeBuffer.shift(); // Mantener solo los últimos 100
            }
            this.updateAverageResponseTime();
        }

        // Estadísticas diarias
        this.updateDailyStats('messages');
    }

    /**
     * Registra la finalización de un flujo
     */
    recordFlowCompletion(flowType: keyof BotMetrics['flowsCompleted']): void {
        this.metrics.flowsCompleted[flowType]++;
    }

    /**
     * Registra un error
     */
    recordError(error: Error, context?: string): void {
        this.metrics.errorCount++;
        this.updateDailyStats('errors');

        console.error(`📊 [METRICS] Error registrado: ${error.message}`, {
            context,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Obtiene un reporte completo de métricas
     */
    getMetricsReport(): BotMetrics & {
        currentActiveUsers: number;
        systemHealth: 'good' | 'warning' | 'critical';
    } {
        const errorRate = this.metrics.messagesProcessed > 0
            ? (this.metrics.errorCount / this.metrics.messagesProcessed) * 100
            : 0;

        let systemHealth: 'good' | 'warning' | 'critical' = 'good';
        if (errorRate > 10) systemHealth = 'critical';
        else if (errorRate > 5) systemHealth = 'warning';

        return {
            ...this.metrics,
            currentActiveUsers: this.currentUsers.size,
            systemHealth
        };
    }

    /**
     * Exporta métricas para análisis externo
     */
    exportMetrics(): string {
        const report = this.getMetricsReport();
        return JSON.stringify(report, null, 2);
    }

    private updateAverageResponseTime(): void {
        if (this.responseTimeBuffer.length > 0) {
            const sum = this.responseTimeBuffer.reduce((a, b) => a + b, 0);
            this.metrics.averageResponseTime = sum / this.responseTimeBuffer.length;
        }
    }

    private updateDailyStats(type: 'messages' | 'errors'): void {
        const today = new Date().toISOString().split('T')[0];

        if (!this.metrics.dailyStats[today]) {
            this.metrics.dailyStats[today] = {
                messages: 0,
                users: 0,
                errors: 0
            };
        }

        if (type === 'messages') {
            this.metrics.dailyStats[today].messages++;
            this.metrics.dailyStats[today].users = this.currentUsers.size;
        } else if (type === 'errors') {
            this.metrics.dailyStats[today].errors++;
        }
    }

    private startPeriodicReporting(): void {
        // Reporte cada hora
        setInterval(() => {
            const report = this.getMetricsReport();
            console.log('📊 [METRICS] Reporte horario:', {
                mensajes: report.messagesProcessed,
                usuarios: report.uniqueUsers,
                errores: report.errorCount,
                salud: report.systemHealth
            });
        }, 60 * 60 * 1000);

        // Limpiar usuarios inactivos cada 30 minutos
        setInterval(() => {
            this.cleanupInactiveUsers();
        }, 30 * 60 * 1000);
    }

    private cleanupInactiveUsers(): void {
        // Por simplicidad, limpiar usuarios después de 30 minutos de inactividad
        // En una implementación real, se tracking sería más sofisticado
        this.currentUsers.clear();
    }
}

export default MetricsService;

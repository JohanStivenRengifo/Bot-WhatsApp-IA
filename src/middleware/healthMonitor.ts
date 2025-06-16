import { Request, Response, NextFunction } from 'express';
import { AzureOpenAIService } from '../services/AzureOpenAIService';

interface HealthStatus {
    isHealthy: boolean;
    lastCheck: Date;
    consecutiveFailures: number;
    lastError?: string;
}

export class HealthMonitorMiddleware {
    private static instance: HealthMonitorMiddleware;
    private azureOpenAIService: AzureOpenAIService | null = null;
    private azureOpenAIStatus: HealthStatus = {
        isHealthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0
    };
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 60000; // 1 minuto
    private readonly MAX_CONSECUTIVE_FAILURES = 3;

    private constructor() {
        this.startHealthMonitoring();
    }

    static getInstance(): HealthMonitorMiddleware {
        if (!HealthMonitorMiddleware.instance) {
            HealthMonitorMiddleware.instance = new HealthMonitorMiddleware();
        }
        return HealthMonitorMiddleware.instance;
    }

    /**
     * Inicia el monitoreo de salud periódico
     */
    private startHealthMonitoring(): void {
        console.log('🔍 Iniciando monitoreo de salud de servicios...');

        this.checkInterval = setInterval(async () => {
            await this.checkAzureOpenAIHealth();
        }, this.CHECK_INTERVAL_MS);

        // Verificación inicial
        setTimeout(() => this.checkAzureOpenAIHealth(), 5000);
    }    /**
     * Obtiene o crea la instancia compartida de AzureOpenAI
     */
    private getAzureOpenAIService(): AzureOpenAIService {
        if (!this.azureOpenAIService) {
            this.azureOpenAIService = new AzureOpenAIService();
        }
        return this.azureOpenAIService;
    }

    /**
     * Verifica la salud del servicio Azure OpenAI
     */
    private async checkAzureOpenAIHealth(): Promise<void> {
        try {
            const azureService = this.getAzureOpenAIService();
            const status = await azureService.getServiceStatus();

            if (status.status === 'active') {
                // Resetear fallos si está saludable
                if (this.azureOpenAIStatus.consecutiveFailures > 0) {
                    console.log('✅ Azure OpenAI Service se ha recuperado');
                    this.azureOpenAIStatus.consecutiveFailures = 0;
                }

                this.azureOpenAIStatus.isHealthy = true;
                this.azureOpenAIStatus.lastError = undefined;
            } else {
                this.azureOpenAIStatus.consecutiveFailures++;
                this.azureOpenAIStatus.lastError = status.error;

                if (this.azureOpenAIStatus.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
                    this.azureOpenAIStatus.isHealthy = false;
                    console.error(`❌ Azure OpenAI Service marcado como no saludable después de ${this.azureOpenAIStatus.consecutiveFailures} fallos consecutivos`);
                } else {
                    console.warn(`⚠️ Azure OpenAI Service fallo ${this.azureOpenAIStatus.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES}: ${status.error}`);
                }
            }

            this.azureOpenAIStatus.lastCheck = new Date();

        } catch (error) {
            this.azureOpenAIStatus.consecutiveFailures++;
            this.azureOpenAIStatus.lastError = error instanceof Error ? error.message : 'Unknown error';

            if (this.azureOpenAIStatus.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
                this.azureOpenAIStatus.isHealthy = false;
                console.error(`❌ Azure OpenAI Service health check failed: ${this.azureOpenAIStatus.lastError}`);
            }

            this.azureOpenAIStatus.lastCheck = new Date();
        }
    }

    /**
     * Middleware para interceptar solicitudes de IA cuando el servicio no está saludable
     */
    public aiHealthCheck = (req: Request, res: Response, next: NextFunction): void => {
        // Verificar si la ruta es para funcionalidades de IA
        const isAIRoute = req.path.includes('/suggestions') ||
            req.path.includes('/ai') ||
            req.path.includes('/generate');

        if (isAIRoute && !this.azureOpenAIStatus.isHealthy) {
            console.warn(`⚠️ Bloqueando solicitud a ${req.path} - Azure OpenAI no está saludable`);

            // Para solicitudes de sugerencias, proporcionar respuestas de respaldo
            if (req.path.includes('/suggestions')) {
                const fallbackResponse = {
                    success: true,
                    data: {
                        conversationId: req.body?.conversationId || 'unknown',
                        analysis: "El servicio de IA no está disponible temporalmente. Por favor, revisa manualmente la conversación.",
                        suggestions: [
                            {
                                type: "professional",
                                text: "Gracias por tu consulta. Un agente revisará tu caso y te responderá pronto."
                            },
                            {
                                type: "empathetic",
                                text: "Lamento cualquier inconveniente. Estamos trabajando para resolver tu solicitud."
                            },
                            {
                                type: "proactive",
                                text: "Mientras tanto, ¿puedes proporcionar más detalles sobre tu consulta?"
                            }
                        ],
                        generatedAt: new Date().toISOString(),
                        model: 'fallback-health-check',
                        processingTimeMs: 0,
                        messageCount: 0,
                        isFailover: true,
                        healthStatus: 'ai_service_unhealthy',
                        lastAIError: this.azureOpenAIStatus.lastError
                    }
                };

                res.json(fallbackResponse);
                return;
            }

            // Para otras rutas de IA, devolver error informativo
            res.status(503).json({
                success: false,
                error: 'El servicio de IA no está disponible temporalmente. Por favor, inténtalo más tarde.',
                details: {
                    service: 'Azure OpenAI',
                    status: 'unhealthy',
                    consecutiveFailures: this.azureOpenAIStatus.consecutiveFailures,
                    lastCheck: this.azureOpenAIStatus.lastCheck.toISOString(),
                    lastError: this.azureOpenAIStatus.lastError
                }
            });
            return;
        }

        next();
    };

    /**
     * Obtiene el estado actual de salud de todos los servicios
     */
    public getHealthStatus() {
        return {
            azureOpenAI: {
                ...this.azureOpenAIStatus,
                lastCheck: this.azureOpenAIStatus.lastCheck.toISOString()
            },
            monitoring: {
                checkIntervalMs: this.CHECK_INTERVAL_MS,
                maxConsecutiveFailures: this.MAX_CONSECUTIVE_FAILURES,
                isActive: this.checkInterval !== null
            }
        };
    }

    /**
     * Fuerza una verificación de salud inmediata
     */
    public async forceHealthCheck(): Promise<void> {
        console.log('🔄 Forzando verificación de salud...');
        await this.checkAzureOpenAIHealth();
    }

    /**
     * Limpia el monitoreo (para testing o shutdown)
     */
    public stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('🛑 Monitoreo de salud detenido');
        }
    }
}

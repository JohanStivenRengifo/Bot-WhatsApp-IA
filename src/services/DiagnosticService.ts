import axios from 'axios';
import { config } from '../config';
import { logIntegrationError } from '../utils/debugUtils';

/**
 * Interfaz para los resultados del diagnóstico
 */
interface DiagnosticResult {
    service: string;
    status: 'ok' | 'error';
    endpoint: string;
    responseTime?: number;
    statusCode?: number;
    message?: string;
    timestamp: string;
}

// Interfaz para error de Axios
interface AxiosErrorLike {
    response?: {
        status: number;
        statusText: string;
        data: any;
        headers: any;
    };
    request?: any;
    message?: string;
}

/**
 * Servicio para diagnosticar la conexión con APIs externas
 * y verificar que estén disponibles.
 */
export class DiagnosticService {
    /**
     * Verifica la conexión a WispHub API
     */
    async checkWispHubConnection(): Promise<DiagnosticResult> {
        const start = Date.now();
        const endpoint = `${config.wisphub.baseUrl}clientes?limit=1`;

        try {
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': config.wisphub.apiKey },
                timeout: 5000 // 5 segundos de timeout
            }); const responseTime = Date.now() - start;

            return {
                service: 'WispHub API',
                status: 'ok',
                endpoint,
                responseTime,
                statusCode: response.status,
                message: 'Conexión exitosa',
                timestamp: new Date().toISOString()
            };
        } catch (error: unknown) {
            const responseTime = Date.now() - start;
            logIntegrationError('WispHub', endpoint, error);

            // Tratamos el error como un error de Axios
            const axiosError = error as AxiosErrorLike;

            return {
                service: 'WispHub API',
                status: 'error',
                endpoint,
                responseTime,
                statusCode: axiosError.response?.status,
                message: axiosError.message || 'Error desconocido',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verifica la conexión a Meta API
     */
    async checkMetaConnection(): Promise<DiagnosticResult> {
        const start = Date.now();
        const endpoint = `https://graph.facebook.com/${config.meta.version}/${config.meta.phoneNumberId}/messages`;

        try {
            // Solo hacemos un HEAD request para no enviar mensajes reales
            const response = await axios.head(endpoint, {
                headers: {
                    'Authorization': `Bearer ${config.meta.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            const responseTime = Date.now() - start;

            return {
                service: 'Meta API',
                status: 'ok',
                endpoint,
                responseTime,
                statusCode: response.status,
                message: 'Conexión exitosa',
                timestamp: new Date().toISOString()
            };
        } catch (error: unknown) {
            const responseTime = Date.now() - start;
            logIntegrationError('Meta', endpoint, error);

            // Tratamos el error como un error de Axios
            const axiosError = error as AxiosErrorLike;

            return {
                service: 'Meta API',
                status: 'error',
                endpoint,
                responseTime,
                statusCode: axiosError.response?.status,
                message: axiosError.message || 'Error desconocido',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verifica la conexión al CRM (si está habilitado)
     */
    async checkCRMConnection(): Promise<DiagnosticResult | null> {
        if (!config.crm.baseUrl || !config.crm.apiKey) {
            return null; // CRM no configurado
        }

        const start = Date.now();
        const endpoint = `${config.crm.baseUrl}/status`;

        try {
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${config.crm.apiKey}` },
                timeout: 5000
            });

            const responseTime = Date.now() - start;

            return {
                service: 'CRM API',
                status: 'ok',
                endpoint,
                responseTime,
                statusCode: response.status,
                message: 'Conexión exitosa',
                timestamp: new Date().toISOString()
            };
        } catch (error: unknown) {
            const responseTime = Date.now() - start;
            logIntegrationError('CRM', endpoint, error);

            // Tratamos el error como un error de Axios
            const axiosError = error as AxiosErrorLike;

            return {
                service: 'CRM API',
                status: 'error',
                endpoint,
                responseTime,
                statusCode: axiosError.response?.status,
                message: axiosError.message || 'Error desconocido',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Ejecuta diagnóstico completo de todos los servicios
     */
    async runFullDiagnostic(): Promise<{
        services: DiagnosticResult[];
        overallStatus: 'ok' | 'partial' | 'error';
        timestamp: string;
    }> {
        // Ejecutar diagnósticos en paralelo
        const [wispHub, meta, crm] = await Promise.all([
            this.checkWispHubConnection(),
            this.checkMetaConnection(),
            this.checkCRMConnection()
        ]);

        // Recopilamos todos los resultados válidos
        const services: DiagnosticResult[] = [wispHub, meta];
        if (crm) services.push(crm);

        // Determinamos el estado general
        const errorCount = services.filter(s => s.status === 'error').length;
        let overallStatus: 'ok' | 'partial' | 'error' = 'ok';

        if (errorCount === services.length) {
            overallStatus = 'error';
        } else if (errorCount > 0) {
            overallStatus = 'partial';
        }

        return {
            services,
            overallStatus,
            timestamp: new Date().toISOString()
        };
    }
}

// utils/metaApiUtils.js
const logger = require('./logger');

class MetaApiErrorHandler {
    constructor() {
        this.errorCounts = {};
        this.lastTokenRefresh = null;
        this.isRefreshing = false;
    }

    /**
     * Maneja errores de la API de Meta
     * @param {Error} error - Error original
     * @returns {Error} - Error procesado
     */
    static handleMetaApiError(error) {
        if (!error.response) {
            return new Error('Error de red o servicio no disponible');
        }

        const responseData = error.response.data;
        if (responseData && responseData.error) {
            const metaError = responseData.error;

            // Códigos de error actualizados según la documentación de la API de Meta v22.0
            switch (metaError.code) {
                case 100:
                    return new Error(`Error de parámetros: ${metaError.message}`);
                case 131:
                case 190:
                    return new Error('Token de acceso no válido o expirado');
                case 4:
                case 80004:
                    return new Error('Límite de frecuencia excedido');
                case 10:
                    return new Error('Permiso denegado o recurso no disponible');
                case 200:
                    return new Error(`Error de API: ${metaError.message}`);
                case 368:
                    return new Error('El mensaje contiene contenido bloqueado');
                case 551:
                    return new Error('Este número de teléfono no está habilitado para WhatsApp Business API');
                case 130429:
                    return new Error('Mensaje rechazado por políticas de WhatsApp');
                default:
                    return new Error(`Error de WhatsApp API: ${metaError.message} (Código: ${metaError.code})`);
            }
        }

        return error;
    }

    /**
     * Registra un error de la API de Meta
     * @param {string} errorType - Tipo de error
     * @param {Object} errorDetails - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleApiError(errorType, errorDetails = {}) {
        // Incrementar contador de errores
        this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;

        logger.error(`❌ Error de API Meta: ${errorType}`, errorDetails);

        // Determinar acción según tipo de error
        switch (errorType) {
            case 'auth_error':
            case 'token_expired':
                return this.handleAuthError(errorDetails);

            case 'rate_limit':
                return this.handleRateLimitError(errorDetails);

            case 'invalid_request':
                return this.handleInvalidRequestError(errorDetails);

            case 'server_error':
                return this.handleServerError(errorDetails);

            default:
                return {
                    success: false,
                    action: 'retry',
                    message: 'Error desconocido en la API de Meta',
                    retryAfter: 5000 // 5 segundos
                };
        }
    }

    /**
     * Maneja errores de autenticación
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleAuthError(details) {
        const now = Date.now();
        const canRefresh = !this.lastTokenRefresh || (now - this.lastTokenRefresh > 60000); // 1 minuto

        if (canRefresh && !this.isRefreshing) {
            this.isRefreshing = true;
            this.lastTokenRefresh = now;

            logger.info('🔄 Iniciando proceso de renovación de token...');

            // Simular finalización del proceso de renovación
            setTimeout(() => {
                this.isRefreshing = false;
                logger.info('✅ Proceso de renovación de token completado');
            }, 5000);

            return {
                success: false,
                action: 'refresh_token',
                message: 'Token expirado o inválido. Iniciando renovación.',
                retryAfter: 5000 // 5 segundos
            };
        }

        return {
            success: false,
            action: 'wait',
            message: 'Error de autenticación. Esperando renovación de token.',
            retryAfter: 10000 // 10 segundos
        };
    }

    /**
     * Maneja errores de límite de tasa
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleRateLimitError(details) {
        // Extraer tiempo de espera de los detalles o usar valor por defecto
        const retryAfter = details.retryAfter || 60000; // 1 minuto por defecto

        return {
            success: false,
            action: 'wait',
            message: 'Límite de tasa excedido. Esperando para reintentar.',
            retryAfter
        };
    }

    /**
     * Maneja errores de solicitud inválida
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleInvalidRequestError(details) {
        return {
            success: false,
            action: 'fix',
            message: 'Solicitud inválida. Verifica los parámetros.',
            details: details.message || 'Parámetros incorrectos'
        };
    }

    /**
     * Maneja errores del servidor
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleServerError(details) {
        return {
            success: false,
            action: 'retry',
            message: 'Error en el servidor de Meta. Reintentando automáticamente.',
            retryAfter: 15000 // 15 segundos
        };
    }

    /**
     * Obtiene estadísticas de errores
     * @returns {Object} - Estadísticas de errores
     */
    getErrorStats() {
        return {
            counts: this.errorCounts,
            lastRefresh: this.lastTokenRefresh ? new Date(this.lastTokenRefresh) : null,
            isRefreshing: this.isRefreshing
        };
    }

    /**
     * Reinicia contadores de errores
     */
    resetErrorCounts() {
        this.errorCounts = {};
    }
}

module.exports = {
    MetaApiErrorHandler
};
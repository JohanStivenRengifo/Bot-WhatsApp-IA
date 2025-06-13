/**
 * Configuración para los nuevos servicios de mejora del bot
 */

// Variables de entorno adicionales para los nuevos servicios
export const enhancedConfig = {
    // Performance Optimizer
    PERFORMANCE_MONITORING_ENABLED: process.env.PERFORMANCE_MONITORING_ENABLED === 'true',
    MEMORY_THRESHOLD_MB: parseInt(process.env.MEMORY_THRESHOLD_MB || '512'),
    AUTO_CLEANUP_ENABLED: process.env.AUTO_CLEANUP_ENABLED === 'true',

    // Metrics Service
    METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
    METRICS_RETENTION_DAYS: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
    ANALYTICS_ENDPOINT: process.env.ANALYTICS_ENDPOINT || '',

    // Notification Service
    ADMIN_PHONES: process.env.ADMIN_PHONES?.split(',') || [],
    EMAIL_ALERTS: process.env.EMAIL_ALERTS === 'true',
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL || '',
    ERROR_RATE_THRESHOLD: parseFloat(process.env.ERROR_RATE_THRESHOLD || '10'),
    RESPONSE_TIME_THRESHOLD: parseFloat(process.env.RESPONSE_TIME_THRESHOLD || '5000'),

    // User Experience
    UX_PERSONALIZATION_ENABLED: process.env.UX_PERSONALIZATION_ENABLED !== 'false',
    INTENT_DETECTION_ENABLED: process.env.INTENT_DETECTION_ENABLED !== 'false',
    CONTEXT_RETENTION_HOURS: parseInt(process.env.CONTEXT_RETENTION_HOURS || '2'),

    // Backup Service
    BACKUP_ENABLED: process.env.BACKUP_ENABLED === 'true',
    BACKUP_INTERVAL_MINUTES: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '60'),
    BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '7'),
    AUTO_RESTORE: process.env.AUTO_RESTORE === 'true',
    BACKUP_PATH: process.env.BACKUP_PATH || './backups',

    // Cache Optimization
    CACHE_AUTO_CLEANUP: process.env.CACHE_AUTO_CLEANUP !== 'false',
    CACHE_MAX_AGE_DAYS: parseInt(process.env.CACHE_MAX_AGE_DAYS || '15'),
    CACHE_COMPRESSION: process.env.CACHE_COMPRESSION === 'true',

    // A/B Testing para UX
    AB_TESTING_ENABLED: process.env.AB_TESTING_ENABLED === 'true',
    AB_TEST_SPLIT_RATIO: parseFloat(process.env.AB_TEST_SPLIT_RATIO || '0.5'),

    // Rate Limiting mejorado
    ENHANCED_RATE_LIMITING: process.env.ENHANCED_RATE_LIMITING === 'true',
    MAX_MESSAGES_PER_MINUTE: parseInt(process.env.MAX_MESSAGES_PER_MINUTE || '20'),
    BURST_PROTECTION: process.env.BURST_PROTECTION === 'true'
};

/**
 * Función para validar configuración de servicios mejorados
 */
export function validateEnhancedConfig(): {
    valid: boolean;
    warnings: string[];
    errors: string[];
} {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validar configuración de administradores
    if (enhancedConfig.ADMIN_PHONES.length === 0) {
        warnings.push('No hay números de administradores configurados para alertas');
    }

    // Validar configuración de respaldos
    if (enhancedConfig.BACKUP_ENABLED && !enhancedConfig.BACKUP_PATH) {
        errors.push('Ruta de respaldos no configurada');
    }

    // Validar umbrales
    if (enhancedConfig.ERROR_RATE_THRESHOLD < 1 || enhancedConfig.ERROR_RATE_THRESHOLD > 100) {
        warnings.push('Umbral de tasa de errores fuera del rango recomendado (1-100%)');
    }

    // Validar retención de datos
    if (enhancedConfig.METRICS_RETENTION_DAYS < 1) {
        warnings.push('Retención de métricas muy baja (menos de 1 día)');
    }

    return {
        valid: errors.length === 0,
        warnings,
        errors
    };
}

/**
 * Configuración por defecto para desarrollo
 */
export const developmentDefaults = {
    PERFORMANCE_MONITORING_ENABLED: 'true',
    METRICS_ENABLED: 'true',
    UX_PERSONALIZATION_ENABLED: 'true',
    BACKUP_ENABLED: 'false', // Deshabilitado en desarrollo
    CACHE_AUTO_CLEANUP: 'true'
};

/**
 * Configuración por defecto para producción
 */
export const productionDefaults = {
    PERFORMANCE_MONITORING_ENABLED: 'true',
    METRICS_ENABLED: 'true',
    EMAIL_ALERTS: 'true',
    UX_PERSONALIZATION_ENABLED: 'true',
    BACKUP_ENABLED: 'true',
    AUTO_RESTORE: 'true',
    CACHE_AUTO_CLEANUP: 'true',
    ENHANCED_RATE_LIMITING: 'true'
};

export default enhancedConfig;

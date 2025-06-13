#!/usr/bin/env node

/**
 * Script para inicializar y configurar los servicios mejorados del bot
 */

import { enhancedConfig, validateEnhancedConfig } from '../src/config/enhanced';
import PerformanceOptimizer from '../src/services/PerformanceOptimizer';
import MetricsService from '../src/services/MetricsService';
import NotificationService from '../src/services/NotificationService';
import UserExperienceService from '../src/services/UserExperienceService';
import BackupService from '../src/services/BackupService';

class EnhancedServicesManager {
    private performanceOptimizer?: PerformanceOptimizer;
    private metricsService?: MetricsService;
    private notificationService?: NotificationService;
    private uxService?: UserExperienceService;
    private backupService?: BackupService;

    /**
     * Inicializa todos los servicios mejorados
     */
    async initializeServices(): Promise<void> {
        console.log('🚀 Inicializando servicios mejorados del bot...\n');

        // Validar configuración
        const configValidation = validateEnhancedConfig();

        if (!configValidation.valid) {
            console.error('❌ Errores en la configuración:');
            configValidation.errors.forEach(error => console.error(`  - ${error}`));
            throw new Error('Configuración inválida');
        }

        if (configValidation.warnings.length > 0) {
            console.warn('⚠️ Advertencias de configuración:');
            configValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
            console.log('');
        }

        // Inicializar servicios uno por uno
        await this.initializePerformanceOptimizer();
        await this.initializeMetricsService();
        await this.initializeNotificationService();
        await this.initializeUserExperienceService();
        await this.initializeBackupService();

        console.log('✅ Todos los servicios mejorados han sido inicializados correctamente\n');
        this.printServiceStatus();
    }

    private async initializePerformanceOptimizer(): Promise<void> {
        if (enhancedConfig.PERFORMANCE_MONITORING_ENABLED) {
            console.log('📊 Inicializando Performance Optimizer...');
            this.performanceOptimizer = PerformanceOptimizer.getInstance();
            console.log('  ✅ Performance Optimizer listo\n');
        } else {
            console.log('⏸️ Performance Optimizer deshabilitado\n');
        }
    }

    private async initializeMetricsService(): Promise<void> {
        if (enhancedConfig.METRICS_ENABLED) {
            console.log('📈 Inicializando Metrics Service...');
            this.metricsService = MetricsService.getInstance();
            console.log('  ✅ Metrics Service listo\n');
        } else {
            console.log('⏸️ Metrics Service deshabilitado\n');
        }
    }

    private async initializeNotificationService(): Promise<void> {
        console.log('📢 Inicializando Notification Service...');
        this.notificationService = NotificationService.getInstance();

        if (enhancedConfig.ADMIN_PHONES.length > 0) {
            console.log(`  📱 ${enhancedConfig.ADMIN_PHONES.length} números de admin configurados`);
        }

        console.log('  ✅ Notification Service listo\n');
    }

    private async initializeUserExperienceService(): Promise<void> {
        if (enhancedConfig.UX_PERSONALIZATION_ENABLED) {
            console.log('🎯 Inicializando User Experience Service...');
            this.uxService = UserExperienceService.getInstance();
            console.log('  ✅ User Experience Service listo\n');
        } else {
            console.log('⏸️ User Experience Service deshabilitado\n');
        }
    }

    private async initializeBackupService(): Promise<void> {
        if (enhancedConfig.BACKUP_ENABLED) {
            console.log('💾 Inicializando Backup Service...');
            this.backupService = BackupService.getInstance();
            console.log(`  📁 Respaldos cada ${enhancedConfig.BACKUP_INTERVAL_MINUTES} minutos`);
            console.log(`  🗑️ Retención: ${enhancedConfig.BACKUP_RETENTION_DAYS} días`);
            console.log('  ✅ Backup Service listo\n');
        } else {
            console.log('⏸️ Backup Service deshabilitado\n');
        }
    }

    private printServiceStatus(): void {
        console.log('📋 Estado de servicios mejorados:');
        console.log('├─ Performance Optimizer:', this.performanceOptimizer ? '🟢 Activo' : '⚪ Inactivo');
        console.log('├─ Metrics Service:', this.metricsService ? '🟢 Activo' : '⚪ Inactivo');
        console.log('├─ Notification Service:', this.notificationService ? '🟢 Activo' : '⚪ Inactivo');
        console.log('├─ User Experience Service:', this.uxService ? '🟢 Activo' : '⚪ Inactivo');
        console.log('└─ Backup Service:', this.backupService ? '🟢 Activo' : '⚪ Inactivo');
        console.log('');
    }

    /**
     * Detiene todos los servicios de forma elegante
     */
    async shutdown(): Promise<void> {
        console.log('🛑 Deteniendo servicios mejorados...');

        if (this.performanceOptimizer) {
            this.performanceOptimizer.shutdown();
        }

        if (this.backupService) {
            this.backupService.shutdown();
        }

        console.log('✅ Servicios detenidos correctamente');
    }

    /**
     * Obtiene estadísticas de todos los servicios
     */
    async getServicesStats(): Promise<any> {
        const stats: any = {
            timestamp: new Date().toISOString(),
            services: {}
        };

        if (this.performanceOptimizer) {
            stats.services.performance = this.performanceOptimizer.getPerformanceMetrics();
        }

        if (this.metricsService) {
            stats.services.metrics = this.metricsService.getMetricsReport();
        }

        if (this.notificationService) {
            stats.services.notifications = this.notificationService.getAlertStats();
        }

        if (this.backupService) {
            stats.services.backups = {
                available: this.backupService.getAvailableBackups().length,
                lastBackup: this.backupService.getAvailableBackups()[0]?.timestamp || 'Nunca'
            };
        }

        return stats;
    }

    /**
     * Ejecuta diagnóstico de salud de los servicios
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Verificar métricas si están disponibles
        if (this.metricsService) {
            const metrics = this.metricsService.getMetricsReport();

            if (metrics.systemHealth === 'critical') {
                issues.push('Sistema en estado crítico');
                recommendations.push('Revisar logs de errores inmediatamente');
            } else if (metrics.systemHealth === 'warning') {
                issues.push('Sistema con advertencias');
                recommendations.push('Monitorear métricas de cerca');
            }

            if (metrics.currentActiveUsers > 100) {
                recommendations.push('Considerar escalamiento horizontal');
            }
        }

        // Verificar notificaciones
        if (this.notificationService) {
            const alertStats = this.notificationService.getAlertStats();

            if (alertStats.active > 5) {
                issues.push(`${alertStats.active} alertas activas sin resolver`);
                recommendations.push('Revisar y resolver alertas pendientes');
            }
        }

        // Verificar respaldos
        if (this.backupService) {
            const backups = this.backupService.getAvailableBackups();

            if (backups.length === 0) {
                issues.push('No hay respaldos disponibles');
                recommendations.push('Crear respaldo manual inmediatamente');
            } else {
                const lastBackup = new Date(backups[0].timestamp);
                const hoursSinceLastBackup = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);

                if (hoursSinceLastBackup > 24) {
                    issues.push('Último respaldo hace más de 24 horas');
                    recommendations.push('Verificar servicio de respaldos automáticos');
                }
            }
        }

        return {
            healthy: issues.length === 0,
            issues,
            recommendations
        };
    }
}

// Exportar para uso en otros módulos
export default EnhancedServicesManager;

// Ejecutar si es llamado directamente
if (require.main === module) {
    const manager = new EnhancedServicesManager();

    manager.initializeServices()
        .then(() => {
            console.log('🎉 Inicialización completa');

            // Manejar señales de terminación
            process.on('SIGTERM', async () => {
                await manager.shutdown();
                process.exit(0);
            });

            process.on('SIGINT', async () => {
                await manager.shutdown();
                process.exit(0);
            });
        })
        .catch(error => {
            console.error('❌ Error durante la inicialización:', error);
            process.exit(1);
        });
}

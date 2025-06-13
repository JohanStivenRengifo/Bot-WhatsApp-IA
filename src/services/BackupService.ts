import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface BackupData {
    timestamp: string;
    version: string;
    sessions: any;
    users: any;
    metrics: any;
    cache: any;
}

export interface BackupConfig {
    enabled: boolean;
    interval: number; // en minutos
    retentionDays: number;
    autoRestore: boolean;
    backupPath: string;
}

/**
 * Sistema de respaldo y recuperación automática
 */
export class BackupService {
    private static instance: BackupService;
    private config!: BackupConfig;
    private backupInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.loadConfig();
        this.initializeService();
    }

    static getInstance(): BackupService {
        if (!BackupService.instance) {
            BackupService.instance = new BackupService();
        }
        return BackupService.instance;
    }

    private loadConfig(): void {
        this.config = {
            enabled: process.env.BACKUP_ENABLED === 'true',
            interval: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '60'), // cada hora por defecto
            retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7'),
            autoRestore: process.env.AUTO_RESTORE === 'true',
            backupPath: process.env.BACKUP_PATH || path.join(process.cwd(), 'backups')
        };
    }

    /**
     * Realiza un respaldo completo del sistema
     */
    async createBackup(): Promise<string> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData: BackupData = {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                sessions: await this.collectSessionData(),
                users: await this.collectUserData(),
                metrics: await this.collectMetricsData(),
                cache: await this.collectCacheData()
            };

            const fileName = `backup_${timestamp}.json`;
            const filePath = path.join(this.config.backupPath, fileName);

            // Asegurar que el directorio existe
            this.ensureBackupDirectory();

            // Guardar respaldo
            fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

            console.log(`💾 Respaldo creado: ${fileName}`);

            // Limpiar respaldos antiguos
            await this.cleanOldBackups();

            return filePath;

        } catch (error) {
            console.error('❌ Error creando respaldo:', error);
            throw error;
        }
    }

    /**
     * Restaura el sistema desde un respaldo
     */
    async restoreFromBackup(backupPath: string): Promise<boolean> {
        try {
            console.log(`🔄 Restaurando desde: ${backupPath}`);

            if (!fs.existsSync(backupPath)) {
                throw new Error(`Archivo de respaldo no encontrado: ${backupPath}`);
            }

            const backupData: BackupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

            // Validar formato del respaldo
            if (!this.validateBackupData(backupData)) {
                throw new Error('Formato de respaldo inválido');
            }

            // Restaurar datos
            await this.restoreSessionData(backupData.sessions);
            await this.restoreUserData(backupData.users);
            await this.restoreMetricsData(backupData.metrics);
            await this.restoreCacheData(backupData.cache);

            console.log(`✅ Restauración completada desde respaldo del ${backupData.timestamp}`);
            return true;

        } catch (error) {
            console.error('❌ Error restaurando respaldo:', error);
            return false;
        }
    }

    /**
     * Obtiene lista de respaldos disponibles
     */
    getAvailableBackups(): Array<{
        fileName: string;
        filePath: string;
        timestamp: string;
        size: number;
    }> {
        try {
            if (!fs.existsSync(this.config.backupPath)) {
                return [];
            }

            const files = fs.readdirSync(this.config.backupPath)
                .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(this.config.backupPath, file);
                    const stats = fs.statSync(filePath);

                    return {
                        fileName: file,
                        filePath,
                        timestamp: stats.birthtime.toISOString(),
                        size: stats.size
                    };
                })
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return files;

        } catch (error) {
            console.error('Error obteniendo lista de respaldos:', error);
            return [];
        }
    }

    /**
     * Restaura automáticamente el último respaldo en caso de fallo
     */
    async autoRestore(): Promise<boolean> {
        if (!this.config.autoRestore) {
            console.log('ℹ️ Restauración automática deshabilitada');
            return false;
        }

        try {
            const backups = this.getAvailableBackups();

            if (backups.length === 0) {
                console.log('⚠️ No hay respaldos disponibles para restauración automática');
                return false;
            }

            const latestBackup = backups[0];
            console.log(`🔄 Iniciando restauración automática desde: ${latestBackup.fileName}`);

            return await this.restoreFromBackup(latestBackup.filePath);

        } catch (error) {
            console.error('❌ Error en restauración automática:', error);
            return false;
        }
    }

    /**
     * Verifica la integridad de un respaldo
     */
    async verifyBackupIntegrity(backupPath: string): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const result = {
            valid: true,
            errors: [] as string[],
            warnings: [] as string[]
        };

        try {
            if (!fs.existsSync(backupPath)) {
                result.errors.push('Archivo de respaldo no existe');
                result.valid = false;
                return result;
            }

            const backupData: BackupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

            // Validaciones básicas
            if (!backupData.timestamp) {
                result.errors.push('Falta timestamp en el respaldo');
                result.valid = false;
            }

            if (!backupData.version) {
                result.warnings.push('Falta información de versión');
            }

            // Validar que las secciones principales existan
            const requiredSections = ['sessions', 'users', 'metrics', 'cache'];
            for (const section of requiredSections) {
                if (!backupData[section as keyof BackupData]) {
                    result.warnings.push(`Sección '${section}' faltante o vacía`);
                }
            }

            // Verificar antigüedad del respaldo
            const backupAge = Date.now() - new Date(backupData.timestamp).getTime();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días

            if (backupAge > maxAge) {
                result.warnings.push('Respaldo tiene más de 7 días de antigüedad');
            }

        } catch (error) {
            result.errors.push(`Error leyendo respaldo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            result.valid = false;
        }

        return result;
    }

    private async collectSessionData(): Promise<any> {
        // Recopilar datos de sesiones activas
        return {
            activeSessions: 0, // Placeholder
            lastActivity: new Date().toISOString()
        };
    }

    private async collectUserData(): Promise<any> {
        // Recopilar datos de usuarios
        return {
            totalUsers: 0, // Placeholder
            authenticatedUsers: 0
        };
    }

    private async collectMetricsData(): Promise<any> {
        // Recopilar métricas del sistema
        return {
            messagesProcessed: 0, // Placeholder
            errors: 0,
            uptime: process.uptime()
        };
    }

    private async collectCacheData(): Promise<any> {
        // Recopilar datos de cache importantes
        try {
            const cacheFile = path.join(process.cwd(), 'invoices_cache.json');
            if (fs.existsSync(cacheFile)) {
                return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            }
        } catch (error) {
            console.warn('No se pudo recopilar datos de cache:', error);
        }
        return {};
    }

    private async restoreSessionData(data: any): Promise<void> {
        console.log('🔄 Restaurando datos de sesiones...');
        // Implementar restauración de sesiones
    }

    private async restoreUserData(data: any): Promise<void> {
        console.log('🔄 Restaurando datos de usuarios...');
        // Implementar restauración de usuarios
    }

    private async restoreMetricsData(data: any): Promise<void> {
        console.log('🔄 Restaurando métricas...');
        // Implementar restauración de métricas
    }

    private async restoreCacheData(data: any): Promise<void> {
        console.log('🔄 Restaurando cache...');
        try {
            if (data && Object.keys(data).length > 0) {
                const cacheFile = path.join(process.cwd(), 'invoices_cache.json');
                fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
                console.log('✅ Cache restaurado');
            }
        } catch (error) {
            console.error('Error restaurando cache:', error);
        }
    }

    private validateBackupData(data: BackupData): boolean {
        return !!(data.timestamp && data.version);
    }

    private ensureBackupDirectory(): void {
        if (!fs.existsSync(this.config.backupPath)) {
            fs.mkdirSync(this.config.backupPath, { recursive: true });
            console.log(`📁 Directorio de respaldos creado: ${this.config.backupPath}`);
        }
    }

    private async cleanOldBackups(): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

            const files = fs.readdirSync(this.config.backupPath);
            let deleted = 0;

            for (const file of files) {
                if (file.startsWith('backup_') && file.endsWith('.json')) {
                    const filePath = path.join(this.config.backupPath, file);
                    const stats = fs.statSync(filePath);

                    if (stats.birthtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        deleted++;
                    }
                }
            }

            if (deleted > 0) {
                console.log(`🗑️ Eliminados ${deleted} respaldos antiguos`);
            }

        } catch (error) {
            console.error('Error limpiando respaldos antiguos:', error);
        }
    }

    private initializeService(): void {
        if (!this.config.enabled) {
            console.log('ℹ️ Servicio de respaldos deshabilitado');
            return;
        }

        // Crear respaldo inicial
        setTimeout(() => {
            this.createBackup().catch(error => {
                console.error('Error en respaldo inicial:', error);
            });
        }, 10000); // 10 segundos después del inicio

        // Programar respaldos periódicos
        this.backupInterval = setInterval(() => {
            this.createBackup().catch(error => {
                console.error('Error en respaldo programado:', error);
            });
        }, this.config.interval * 60 * 1000);

        console.log(`💾 BackupService iniciado - Respaldos cada ${this.config.interval} minutos`);
    }

    /**
     * Detiene el servicio de respaldos
     */
    shutdown(): void {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
        }
        console.log('🛑 BackupService detenido');
    }
}

export default BackupService;

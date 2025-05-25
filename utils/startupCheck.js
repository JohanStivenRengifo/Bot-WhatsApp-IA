const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class StartupCheck {
    constructor() {
        this.requiredEnvVars = [
            'PORT',
            'MONGODB_URI',
            'META_JWT_TOKEN',
            'META_NUMBER_ID',
            'META_VERIFY_TOKEN'
        ];

        this.requiredFolders = [
            'logs',
            'flows',
            'controllers',
            'services',
            'models',
            'utils'
        ];
    }

    async checkEnvironmentVariables() {
        const missingVars = this.requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
        }

        logger.info('✅ Variables de entorno verificadas');
        return true;
    }

    async checkFolders() {
        const missingFolders = this.requiredFolders.filter(folder => {
            const folderPath = path.join(path.resolve(__dirname, '..'), folder);
            return !fs.existsSync(folderPath);
        });

        if (missingFolders.length > 0) {
            throw new Error(`Carpetas faltantes: ${missingFolders.join(', ')}`);
        }

        logger.info('✅ Estructura de carpetas verificada');
        return true;
    }

    async checkDependencies() {
        const packageJson = require(path.resolve(__dirname, '../package.json'));
        const requiredDeps = [
            'express',
            'mongoose',
            'node-cron',
            'moment-timezone',
            'winston'
        ];

        const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

        if (missingDeps.length > 0) {
            throw new Error(`Dependencias faltantes: ${missingDeps.join(', ')}`);
        }

        logger.info('✅ Dependencias verificadas');
        return true;
    }

    async checkLogs() {
        const logsPath = path.join(__dirname, 'logs');

        if (!fs.existsSync(logsPath)) {
            fs.mkdirSync(logsPath);
        }

        const logFiles = ['error.log', 'combined.log'];

        for (const file of logFiles) {
            const filePath = path.join(logsPath, file);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, '');
            }
        }

        logger.info('✅ Archivos de log verificados');
        return true;
    }

    async runAllChecks() {
        try {
            await this.checkEnvironmentVariables();
            await this.checkFolders();
            await this.checkDependencies();
            await this.checkLogs();

            logger.info('✅ Todas las verificaciones completadas exitosamente');
            return true;
        } catch (error) {
            logger.error('❌ Error en verificaciones de inicio:', error);
            throw error;
        }
    }
}

module.exports = new StartupCheck();

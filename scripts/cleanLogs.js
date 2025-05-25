const fs = require('fs');
const path = require('path');
const moment = require('moment');
const logger = require('../utils/logger');

class LogCleaner {
    constructor() {
        this.logsPath = path.join(__dirname, '..', 'logs');
        this.retentionDays = 30; // Mantener logs por 30 días
    }

    async cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logsPath);
            const cutoffDate = moment().subtract(this.retentionDays, 'days');
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.logsPath, file);
                const stats = fs.statSync(filePath);
                const fileDate = moment(stats.mtime);

                if (fileDate.isBefore(cutoffDate)) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            logger.info(`✅ Limpieza de logs completada: ${deletedCount} archivos eliminados`);
            return deletedCount;
        } catch (error) {
            logger.error('❌ Error limpiando logs antiguos:', error);
            throw error;
        }
    }
}

// Si el script se ejecuta directamente
if (require.main === module) {
    const cleaner = new LogCleaner();
    cleaner.cleanOldLogs()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = new LogCleaner();

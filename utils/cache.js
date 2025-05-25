const Redis = require('redis');
const logger = require('./logger');

class CacheManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.init();
    }

    async init() {
        try {
            this.client = Redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            this.client.on('error', (err) => {
                logger.error('Error en conexión Redis:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('✅ Conectado a Redis exitosamente');
                this.isConnected = true;
            });

            await this.client.connect();
        } catch (error) {
            logger.error('Error iniciando Redis:', error);
        }
    }

    async get(key) {
        if (!this.isConnected) return null;
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Error obteniendo valor de caché:', error);
            return null;
        }
    }

    async set(key, value, expireSeconds = 3600) {
        if (!this.isConnected) return false;
        try {
            await this.client.set(key, JSON.stringify(value), {
                EX: expireSeconds
            });
            return true;
        } catch (error) {
            logger.error('Error estableciendo valor en caché:', error);
            return false;
        }
    }

    async delete(key) {
        if (!this.isConnected) return false;
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Error eliminando valor de caché:', error);
            return false;
        }
    }

    async clearAll() {
        if (!this.isConnected) return false;
        try {
            await this.client.flushAll();
            return true;
        } catch (error) {
            logger.error('Error limpiando caché:', error);
            return false;
        }
    }
}

module.exports = new CacheManager();

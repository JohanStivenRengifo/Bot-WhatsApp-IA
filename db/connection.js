// db/connection.js
const mongoose = require('mongoose');
const config = require('../config');

class DatabaseConnection {
    constructor() {
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 segundos
    }

    async connect() {
        if (this.isConnected || mongoose.connection.readyState === 1) {
            console.log('📊 Ya conectado a MongoDB');
            return;
        }

        this.connectionAttempts++;
        console.log(`🔄 Intentando conectar a MongoDB (intento ${this.connectionAttempts})...`);

        try {
            await mongoose.connect(config.db.mongoUri);

            this.isConnected = true;
            this.connectionAttempts = 0;

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ Conexión a MongoDB perdida');
                this.isConnected = false;
            });

            console.log('✅ Conectado a MongoDB exitosamente');
        } catch (error) {
            console.error('❌ Error conectando a MongoDB:', error);

            if (this.connectionAttempts < this.maxRetries) {
                console.log(`⏱️ Reintentando en ${this.retryDelay / 1000} segundos...`);
                return new Promise(resolve => {
                    setTimeout(() => this.connect().then(resolve), this.retryDelay);
                });
            } else {
                console.error(`❌ Máximo número de intentos (${this.maxRetries}) alcanzado. No se pudo conectar a MongoDB.`);
                throw error;
            }
        }
    }

    async disconnect() {
        if (!this.isConnected) {
            console.log('📊 No hay conexión activa a MongoDB');
            return;
        }

        try {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('✅ Desconectado de MongoDB exitosamente');
        } catch (error) {
            console.error('❌ Error desconectando de MongoDB:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            connectionState: mongoose.connection.readyState,
            connectionAttempts: this.connectionAttempts
        };
    }
}

module.exports = new DatabaseConnection();
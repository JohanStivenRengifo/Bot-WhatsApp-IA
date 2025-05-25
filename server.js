// server.js - Archivo principal del Bot de WhatsApp para Conecta2
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const routes = require('./routes/index');
const { debugMiddleware, authMiddleware, errorHandler, webhookVerificationMiddleware } = require('./middleware');
const dbConnection = require('./db/connection');
const logger = require('./utils/logger');
const metaApiService = require('./services/metaApiService');
const startupCheck = require('./utils/startupCheck');

// Crear la aplicación Express
const app = express();

// Configuración de rate limiting mejorada
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 requests por ventana por IP
    message: { error: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde' },
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware de seguridad y optimización
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: config.app.allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware básico
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiLimiter);

// Middleware personalizado
app.use(debugMiddleware);
app.use('/api', authMiddleware);
app.use('/webhook', webhookVerificationMiddleware);

// Rutas
app.use('/', routes);

// Manejador de errores
app.use(errorHandler);

// Función para inicializar el servidor
const initializeServer = async () => {
    try {
        // Ejecutar verificaciones de inicio
        await startupCheck.runAllChecks();

        // Conectar a la base de datos
        await dbConnection.connect();
        logger.info('✅ Conexión a la base de datos establecida');

        // Verificar conexión con la API de Meta
        await metaApiService.verifyConnection();
        logger.info('✅ Conexión con la API de Meta verificada');

        // Configurar webhook de WhatsApp
        await metaApiService.setupWebhook();
        logger.info('✅ Webhook de WhatsApp configurado');

        // Iniciar el servidor
        const port = config.app.port;
        const server = app.listen(port, () => {
            logger.info(`🚀 Servidor iniciado en el puerto ${port}`);
            logger.info(`📝 Ambiente: ${config.app.nodeEnv}`);
            logger.info(`🔗 URL del Webhook: ${config.app.webhookUrl}`);
        });

        // Configurar timeout del servidor
        server.timeout = 120000; // 2 minutos
        server.keepAliveTimeout = 65000; // 65 segundos

    } catch (error) {
        logger.error('❌ Error iniciando el servidor:', error);
        process.exit(1);
    }
};

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    logger.error('❌ Error no capturado:', error);
    // Dar tiempo para que los logs se escriban antes de cerrar
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (error) => {
    logger.error('❌ Promesa rechazada no manejada:', error);
    // Dar tiempo para que los logs se escriban antes de cerrar
    setTimeout(() => process.exit(1), 1000);
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
    logger.info('👋 Señal SIGTERM recibida. Cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('👋 Señal SIGINT recibida. Cerrando servidor...');
    process.exit(0);
});

// Iniciar el servidor
initializeServer();
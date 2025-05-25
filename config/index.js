// config/index.js
require('dotenv').config();

// Validación de variables de entorno requeridas
const requiredEnvVars = [
    'MONGODB_URI',
    'META_JWT_TOKEN',
    'META_NUMBER_ID',
    'META_VERIFY_TOKEN',
    'META_BUSINESS_ACCOUNT_ID'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`La variable de entorno ${envVar} es requerida`);
    }
}

const config = {
    app: {
        port: process.env.PORT || 3008,
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3008/webhook',
        allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(','),
        maxPayloadSize: '10mb',
        sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
        trustProxy: process.env.TRUST_PROXY === 'true'
    },
    db: {
        mongoUri: process.env.MONGODB_URI,
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            minPoolSize: 5,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            heartbeatFrequencyMS: 10000
        }
    },
    meta: {
        jwtToken: process.env.META_JWT_TOKEN,
        numberId: process.env.META_NUMBER_ID,
        verifyToken: process.env.META_VERIFY_TOKEN,
        apiVersion: process.env.META_API_VERSION || 'v22.0',
        baseUrl: 'https://graph.facebook.com',
        businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID,
        crmAppId: process.env.META_CRM_APP_ID,
        webhookFields: [
            'messages',
            'message_deliveries',
            'message_reads',
            'message_template_status_updates'
        ],
        webhookVersion: 'v2.0'
    },
    wisphub: {
        subdomain: process.env.WISPHUB_SUBDOMAIN || 'wisphub.app',
        apiKey: process.env.WISPHUB_API_KEY,
        environment: process.env.NODE_ENV || 'development',
        timeout: 30000,
        retryAttempts: 3
    },
    security: {
        tokenExpirationTime: 24 * 60 * 60 * 1000, // 24 horas
        refreshTokenExpirationTime: 7 * 24 * 60 * 60 * 1000, // 7 días
        bcryptSaltRounds: 10,
        jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 100 // límite de 100 requests por ventana
        }
    },
    retry: {
        delay: 5000,
        maxRetries: 3,
        backoffFactor: 2
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        directory: process.env.LOG_DIR || 'logs',
        maxSize: '20m',
        maxFiles: '14d'
    }
};

module.exports = config;
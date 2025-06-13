import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Meta/WhatsApp Configuration
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
    WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || '',
    PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || '',
    META_VERSION: 'v18.0',

    // Database Configuration (PostgreSQL)
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_NAME: process.env.DB_NAME || 'whatsapp_bot',
    DB_USER: process.env.DB_USER || 'bot_user',
    DB_PASSWORD: process.env.DB_PASSWORD || 'bot_password',
    DB_SSL: process.env.DB_SSL || 'false',
    DB_MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),

    // Redis Configuration
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
    REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'whatsapp_bot:',

    // MongoDB Configuration
    MONGODB_URI: process.env.MONGODB_URI || '',

    // WispHub API Configuration
    WISPHUB_API_URL: process.env.WISPHUB_API_URL || '',
    WISPHUB_API_KEY: process.env.WISPHUB_API_KEY || '', WISPHUB_DEFAULT_TECHNICIAN_ID: process.env.WISPHUB_DEFAULT_TECHNICIAN_ID || '',

    // Azure OpenAI Configuration
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'model-router',
    AZURE_OPENAI_MODEL_NAME: process.env.AZURE_OPENAI_MODEL_NAME || 'model-router',

    // CRM Configuration
    CRM_API_URL: process.env.CRM_API_URL || 'http://localhost:4000/api/crm',
    CRM_API_KEY: process.env.CRM_API_KEY || '',
    CRM_ENABLED: process.env.CRM_ENABLED === 'true',
    CRM_WEBHOOK_URL: process.env.CRM_WEBHOOK_URL || '',
    CRM_REALTIME_SYNC: process.env.CRM_REALTIME_SYNC === 'true',

    // Server Configuration
    PORT: parseInt(process.env.PORT || '3000'),
    HOST: process.env.HOST || '0.0.0.0',
    CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),

    // Bot Configuration
    BOT_ENABLED: process.env.BOT_ENABLED !== 'false',
    BOT_MAINTENANCE_MODE: process.env.BOT_MAINTENANCE_MODE === 'true',
    BOT_MAX_CONCURRENT_SESSIONS: parseInt(process.env.BOT_MAX_CONCURRENT_SESSIONS || '100'),
    BOT_SESSION_TIMEOUT_MINUTES: parseInt(process.env.BOT_SESSION_TIMEOUT_MINUTES || '30'),
    BOT_ENABLE_ANALYTICS: process.env.BOT_ENABLE_ANALYTICS !== 'false',
    BOT_ENABLE_METRICS: process.env.BOT_ENABLE_METRICS !== 'false',

    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // JWT Secret (for CRM authentication)
    JWT_SECRET: process.env.JWT_SECRET || 'crm-secret-key-super-secure-2024',

    // Legacy compatibility
    meta: {
        accessToken: process.env.META_ACCESS_TOKEN || '',
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
        phoneNumberId: process.env.PHONE_NUMBER_ID || '',
        version: 'v18.0'
    },
    wisphub: {
        baseUrl: process.env.WISPHUB_API_URL || '',
        apiKey: process.env.WISPHUB_API_KEY || '',
        defaultTechnicianId: process.env.WISPHUB_DEFAULT_TECHNICIAN_ID || ''
    }, crm: {
        baseUrl: process.env.CRM_API_URL || '',
        apiKey: process.env.CRM_API_KEY || ''
    },
    azureOpenAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'model-router',
        modelName: process.env.AZURE_OPENAI_MODEL_NAME || 'model-router'
    },
    server: {
        port: parseInt(process.env.PORT || '3000')
    }
};

export function validateEnvironment(): void {
    const requiredVars = [
        'META_ACCESS_TOKEN',
        'WEBHOOK_VERIFY_TOKEN',
        'PHONE_NUMBER_ID',
        'WISPHUB_API_URL',
        'WISPHUB_API_KEY',
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_API_KEY',
        'CRM_API_URL',
        'CRM_API_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        process.exit(1);
    }
}
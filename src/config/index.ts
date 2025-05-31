 import dotenv from 'dotenv';
dotenv.config();

export const config = {
    meta: {
        accessToken: process.env.META_ACCESS_TOKEN || '',
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
        phoneNumberId: process.env.PHONE_NUMBER_ID || '',
        version: 'v18.0'
    },
    wisphub: {
        baseUrl: process.env.WISPHUB_API_URL || '',
        apiKey: process.env.WISPHUB_API_KEY || ''
    },
    crm: {
        baseUrl: process.env.CRM_API_URL || '',
        apiKey: process.env.CRM_API_KEY || ''
    },
    ai: {
        openai: {
            apiKey: process.env.OPENAI_API_KEY || ''
        },
        gemini: {
            apiKey: process.env.GEMINI_API_KEY || ''
        },
        primaryService: process.env.AI_PRIMARY_SERVICE || 'openai',
        fallbackService: process.env.AI_FALLBACK_SERVICE || 'gemini'
    },
    server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000
    }
};

export function validateEnvironment(): void {
    const requiredVars = [
        'META_ACCESS_TOKEN',
        'WEBHOOK_VERIFY_TOKEN',
        'PHONE_NUMBER_ID',
        'WISPHUB_API_URL',
        'WISPHUB_API_KEY',
        'CRM_API_URL',
        'CRM_API_KEY'
    ];

    const aiVars = [
        'OPENAI_API_KEY',
        'GEMINI_API_KEY'
    ];

    // At least one AI service must be configured
    const hasAIService = aiVars.some(varName => process.env[varName]);
    if (!hasAIService) {
        console.error('❌ At least one AI service must be configured (OpenAI or Gemini)');
        process.exit(1);
    }

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        process.exit(1);
    }
}
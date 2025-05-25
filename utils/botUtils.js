// utils/botUtils.js
const cron = require('node-cron');
const moment = require('moment-timezone');
const config = require('../config');
const Conversation = require('../models/conversation');

// Configurar zona horaria colombiana
moment.tz.setDefault('America/Bogota');

/**
 * Utilidades para validación, formateo y operaciones comunes del bot
 */
const BotUtils = {
    // Validar número de teléfono colombiano
    validatePhoneNumber: (phoneNumber) => {
        const colombianPhoneRegex = /^57[0-9]{10}$/;
        return colombianPhoneRegex.test(phoneNumber);
    },

    // Formatear número de teléfono
    formatPhoneNumber: (phoneNumber) => {
        if (phoneNumber.startsWith('57')) {
            return phoneNumber;
        }
        if (phoneNumber.startsWith('3')) {
            return `57${phoneNumber}`;
        }
        return phoneNumber;
    },

    // Validar número de cuenta
    validateAccountNumber: (accountNumber) => {
        return /^[0-9]{10}$/.test(accountNumber);
    },

    // Generar ID único para tickets
    generateTicketId: () => {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TK${timestamp.slice(-6)}${random}`;
    },

    // Formatear fecha para Colombia
    formatDateColombia: (date = new Date()) => {
        return moment(date).format('DD/MM/YYYY HH:mm:ss');
    },

    // Verificar horario de atención
    isBusinessHours: () => {
        const now = moment();
        const hour = now.hour();
        const day = now.day(); // 0 = domingo, 6 = sábado

        // Lunes a viernes: 7AM - 9PM
        // Sábados: 8AM - 6PM  
        // Domingos: 9AM - 5PM
        if (day >= 1 && day <= 5) {
            return hour >= 7 && hour < 21;
        } else if (day === 6) {
            return hour >= 8 && hour < 18;
        } else {
            return hour >= 9 && hour < 17;
        }
    },

    // Limpiar y normalizar texto de entrada
    cleanText: (text) => {
        return text
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remover acentos
    },

    // Detectar intención del usuario
    detectIntent: (message) => {
        const cleanMessage = BotUtils.cleanText(message);

        const intents = {
            greeting: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos'],
            billing: ['factura', 'pago', 'saldo', 'cuenta', 'deuda', 'vencimiento'],
            technical: ['internet', 'señal', 'lento', 'no funciona', 'problema', 'falla'],
            services: ['plan', 'servicio', 'contratar', 'precio', 'oferta'],
            goodbye: ['gracias', 'chao', 'adios', 'hasta luego', 'bye'],
            human: ['agente', 'humano', 'persona', 'operador', 'asesor']
        };

        for (const [intent, keywords] of Object.entries(intents)) {
            if (keywords.some(keyword => cleanMessage.includes(keyword))) {
                return intent;
            }
        }

        return 'unknown';
    },

    // Calcular tiempo de respuesta promedio
    calculateResponseTime: (startTime) => {
        const endTime = new Date();
        const responseTime = endTime - startTime;
        return Math.round(responseTime / 1000); // En segundos
    },

    // Generar mensaje de espera personalizado
    getWaitingMessage: () => {
        const messages = [
            "⏳ Un momento por favor, estoy procesando tu solicitud...",
            "🔄 Buscando la mejor solución para ti...",
            "⏱️ Dame unos segundos para ayudarte...",
            "🔍 Consultando la información que necesitas..."
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    },

    // Validar formato de email
    validateEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};

// Sistema de métricas y analytics
class BotAnalytics {
    constructor() {
        this.metrics = {
            totalMessages: 0,
            totalUsers: new Set(),
            conversationsByHour: {},
            intentCounts: {},
            responseTimes: [],
            satisfactionRatings: []
        };
    }

    // Registrar mensaje
    recordMessage(phoneNumber, intent) {
        this.metrics.totalMessages++;
        this.metrics.totalUsers.add(phoneNumber);

        const hour = moment().hour();
        this.metrics.conversationsByHour[hour] = (this.metrics.conversationsByHour[hour] || 0) + 1;

        if (intent) {
            this.metrics.intentCounts[intent] = (this.metrics.intentCounts[intent] || 0) + 1;
        }
    }

    // Registrar tiempo de respuesta
    recordResponseTime(time) {
        this.metrics.responseTimes.push(time);
        // Mantener solo los últimos 1000 registros
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes.shift();
        }
    }

    // Registrar calificación de satisfacción
    recordSatisfaction(rating) {
        this.metrics.satisfactionRatings.push(rating);
    }

    // Obtener estadísticas
    getStats() {
        const avgResponseTime = this.metrics.responseTimes.length > 0
            ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
            : 0;

        const avgSatisfaction = this.metrics.satisfactionRatings.length > 0
            ? this.metrics.satisfactionRatings.reduce((a, b) => a + b, 0) / this.metrics.satisfactionRatings.length
            : 0;

        return {
            totalMessages: this.metrics.totalMessages,
            uniqueUsers: this.metrics.totalUsers.size,
            averageResponseTime: Math.round(avgResponseTime * 100) / 100,
            averageSatisfaction: Math.round(avgSatisfaction * 100) / 100,
            conversationsByHour: this.metrics.conversationsByHour,
            topIntents: Object.entries(this.metrics.intentCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
        };
    }
}

// Sistema de plantillas de mensajes
const MessageTemplates = {
    // Mensajes de bienvenida por horario
    getWelcomeMessage: () => {
        const hour = moment().hour();
        let greeting;

        if (hour < 12) {
            greeting = "¡Buenos días! ☀️";
        } else if (hour < 18) {
            greeting = "¡Buenas tardes! 🌤️";
        } else {
            greeting = "¡Buenas noches! 🌙";
        }

        return `${greeting} Bienvenido al soporte de *TelecomPro*\n\nSoy tu asistente virtual disponible 24/7 para ayudarte. ¿En qué puedo asistirte hoy?`;
    },

    // Mensajes fuera de horario
    getOutOfHoursMessage: () => {
        const nextBusinessDay = moment().add(1, 'day').format('dddd DD/MM');
        return `🌙 Actualmente estamos fuera del horario de atención normal.

⏰ *Horarios de atención:*
• Lunes a Viernes: 7:00 AM - 9:00 PM
• Sábados: 8:00 AM - 6:00 PM  
• Domingos: 9:00 AM - 5:00 PM

Puedo ayudarte con consultas básicas las 24 horas. Para atención especializada, nuestro equipo estará disponible el ${nextBusinessDay}.

¿En qué puedo ayudarte?`;
    },

    // Mensaje de transferencia a agente
    getTransferMessage: (waitTime = '3-5 minutos') => {
        return `👤 *Transfiriendo a agente humano*

⏱️ Tiempo estimado de espera: ${waitTime}
📋 He enviado tu información al agente
🔔 Te notificaremos cuando esté disponible

*Mientras esperas:*
• Mantén activo WhatsApp
• Ten a mano tu número de cuenta
• El agente se identificará al contactarte

¡Gracias por tu paciencia! 😊`;
    },

    // Mensaje de ticket creado
    getTicketCreatedMessage: (ticketId, issueType) => {
        return `🎫 *Ticket de Soporte Creado*

📄 **ID del Ticket:** ${ticketId}
🔧 **Tipo:** ${issueType}
📅 **Fecha:** ${BotUtils.formatDateColombia()}
⏰ **Tiempo estimado:** 2-4 horas hábiles

*¿Qué sigue?*
• Un especialista revisará tu caso
• Te contactaremos por WhatsApp o llamada
• Puedes consultar el estado con el ID del ticket

📧 También puedes seguir tu ticket en: www.telecompro.com/soporte`;
    },

    // Mensaje de satisfacción
    getSatisfactionMessage: () => {
        return `⭐ *Tu opinión es importante*

¿Cómo calificarías la atención recibida?

Califícanos del 1 al 5:
⭐ = 1 (Muy malo)
⭐⭐ = 2 (Malo)  
⭐⭐⭐ = 3 (Regular)
⭐⭐⭐⭐ = 4 (Bueno)
⭐⭐⭐⭐⭐ = 5 (Excelente)

Solo responde con el número (1-5)`;
    },

    getWelcomeMessage: (name) => {
        return `¡Hola ${name || 'bienvenido'}! 👋\n\nSoy el asistente virtual de Conecta2 Telecomunicaciones. Estoy aquí para ayudarte con:\n\n1️⃣ Registro de servicios\n2️⃣ Soporte técnico\n\nPor favor, responde con el número de la opción que necesitas.`;
    },

    getMainMenu: () => {
        return `🔍 ¿En qué puedo ayudarte hoy?\n\n1️⃣ Registro de servicios\n2️⃣ Soporte técnico\n\nResponde con el número de la opción deseada.`;
    },

    getRegistroWelcome: () => {
        return `📝 *Registro de Servicios*\n\nPara comenzar el proceso de registro, necesitaré algunos datos:\n\n1. Tu nombre completo\n2. Dirección\n3. Tipo de servicio que deseas\n\nPor favor, comienza proporcionándome tu nombre completo.`;
    },

    getSoporteWelcome: () => {
        return `🛠️ *Soporte Técnico*\n\nPor favor, describe brevemente el problema que estás experimentando y uno de nuestros técnicos te atenderá lo antes posible.`;
    },

    getInvalidOptionMessage: () => {
        return `⚠️ Opción no válida. Por favor, selecciona una de las opciones disponibles.`;
    },

    getErrorMessage: () => {
        return `❌ Lo siento, ha ocurrido un error. Por favor, intenta nuevamente en unos momentos o contacta a nuestro equipo de soporte.`;
    },

    getPrivacyNotice: () => {
        return `🔒 *Aviso de Privacidad*\n\nConecta2 Telecomunicaciones trata tus datos personales conforme a la Ley 1581 de 2012. Tus datos serán utilizados para:\n\n- Gestionar tu solicitud\n- Brindarte soporte técnico\n- Enviarte información relevante sobre nuestros servicios\n\n¿Aceptas nuestra política de privacidad? Responde SI para continuar.`;
    }
};

// Sistema de tareas programadas
class BotScheduler {
    constructor(Conversation) {
        this.Conversation = Conversation;
        this.setupScheduledTasks();
    }

    setupScheduledTasks() {
        // Limpiar conversaciones inactivas cada día a las 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🧹 Ejecutando limpieza de conversaciones inactivas...');
            await this.cleanInactiveConversations();
        });

        // Reporte diario a las 8 AM
        cron.schedule('0 8 * * *', async () => {
            console.log('📊 Generando reporte diario...');
            await this.generateDailyReport();
        });

        // Recordatorio de seguimiento cada 4 horas
        cron.schedule('0 */4 * * *', async () => {
            console.log('🔔 Verificando tickets pendientes...');
            await this.checkPendingTickets();
        });
    }

    async cleanInactiveConversations() {
        try {
            const cutoffDate = moment().subtract(7, 'days').toDate();

            const result = await this.Conversation.updateMany(
                {
                    lastActivity: { $lt: cutoffDate },
                    isActive: true
                },
                {
                    $set: { isActive: false }
                }
            );

            console.log(`✅ ${result.modifiedCount} conversaciones marcadas como inactivas`);
        } catch (error) {
            console.error('❌ Error en limpieza de conversaciones:', error);
        }
    }

    async generateDailyReport() {
        try {
            const today = moment().startOf('day').toDate();
            const tomorrow = moment().add(1, 'day').startOf('day').toDate();

            const dailyStats = await this.Conversation.aggregate([
                {
                    $match: {
                        lastActivity: { $gte: today, $lt: tomorrow }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalConversations: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$phoneNumber' },
                        ticketsCreated: {
                            $sum: {
                                $cond: [{ $ne: ['$userData.ticketId', null] }, 1, 0]
                            }
                        }
                    }
                }
            ]);

            if (dailyStats.length > 0) {
                const stats = dailyStats[0];
                console.log(`📈 Reporte del ${moment().format('DD/MM/YYYY')}:`);
                console.log(`   • Conversaciones: ${stats.totalConversations}`);
                console.log(`   • Usuarios únicos: ${stats.uniqueUsers.length}`);
                console.log(`   • Tickets creados: ${stats.ticketsCreated}`);
            }
        } catch (error) {
            console.error('❌ Error generando reporte:', error);
        }
    }

    async checkPendingTickets() {
        try {
            const cutoffDate = moment().subtract(6, 'hours').toDate();

            const pendingTickets = await this.Conversation.find({
                'userData.ticketId': { $exists: true, $ne: null },
                lastActivity: { $lt: cutoffDate },
                currentFlow: { $ne: 'resolved' }
            });

            console.log(`🎫 ${pendingTickets.length} tickets requieren seguimiento`);

            // Aquí se podría implementar notificaciones automáticas
            // o escalamiento a supervisores

        } catch (error) {
            console.error('❌ Error verificando tickets:', error);
        }
    }
}

// Sistema de caché simple
class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 5 * 60 * 1000; // 5 minutos
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    clear() {
        this.cache.clear();
    }
}

/**
 * Clase para manejar errores de la API de Meta
 */
class MetaApiErrorHandler {
    constructor() {
        this.errorCounts = {};
        this.lastTokenRefresh = null;
        this.isRefreshing = false;
    }

    /**
     * Registra un error de la API de Meta
     * @param {string} errorType - Tipo de error
     * @param {Object} errorDetails - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleApiError(errorType, errorDetails = {}) {
        // Incrementar contador de errores
        this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;

        console.error(`❌ Error de API Meta: ${errorType}`, errorDetails);

        // Determinar acción según tipo de error
        switch (errorType) {
            case 'auth_error':
            case 'token_expired':
                return this.handleAuthError(errorDetails);

            case 'rate_limit':
                return this.handleRateLimitError(errorDetails);

            case 'invalid_request':
                return this.handleInvalidRequestError(errorDetails);

            case 'server_error':
                return this.handleServerError(errorDetails);

            default:
                return {
                    success: false,
                    action: 'retry',
                    message: 'Error desconocido en la API de Meta',
                    retryAfter: 5000 // 5 segundos
                };
        }
    }

    /**
     * Maneja errores de autenticación
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleAuthError(details) {
        const now = Date.now();
        const canRefresh = !this.lastTokenRefresh || (now - this.lastTokenRefresh > 60000); // 1 minuto

        if (canRefresh && !this.isRefreshing) {
            this.isRefreshing = true;
            this.lastTokenRefresh = now;

            // Aquí se implementaría la lógica para refrescar el token
            // Por ejemplo, notificar a un administrador o intentar renovar automáticamente

            console.log('🔄 Iniciando proceso de renovación de token...');

            // Simular finalización del proceso de renovación
            setTimeout(() => {
                this.isRefreshing = false;
                console.log('✅ Proceso de renovación de token completado');
            }, 5000);

            return {
                success: false,
                action: 'refresh_token',
                message: 'Token expirado o inválido. Iniciando renovación.',
                retryAfter: 5000 // 5 segundos
            };
        }

        return {
            success: false,
            action: 'wait',
            message: 'Error de autenticación. Esperando renovación de token.',
            retryAfter: 10000 // 10 segundos
        };
    }

    /**
     * Maneja errores de límite de tasa
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleRateLimitError(details) {
        // Extraer tiempo de espera de los detalles o usar valor por defecto
        const retryAfter = details.retryAfter || 60000; // 1 minuto por defecto

        return {
            success: false,
            action: 'wait',
            message: 'Límite de tasa excedido. Esperando para reintentar.',
            retryAfter
        };
    }

    /**
     * Maneja errores de solicitud inválida
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleInvalidRequestError(details) {
        return {
            success: false,
            action: 'fix',
            message: 'Solicitud inválida. Verifica los parámetros.',
            details: details.message || 'Parámetros incorrectos'
        };
    }

    /**
     * Maneja errores del servidor
     * @param {Object} details - Detalles del error
     * @returns {Object} - Información sobre el error y acciones recomendadas
     */
    handleServerError(details) {
        return {
            success: false,
            action: 'retry',
            message: 'Error en el servidor de Meta. Reintentando automáticamente.',
            retryAfter: 15000 // 15 segundos
        };
    }

    /**
     * Obtiene estadísticas de errores
     * @returns {Object} - Estadísticas de errores
     */
    getErrorStats() {
        return {
            counts: this.errorCounts,
            lastRefresh: this.lastTokenRefresh ? new Date(this.lastTokenRefresh) : null,
            isRefreshing: this.isRefreshing
        };
    }

    /**
     * Reinicia contadores de errores
     */
    resetErrorCounts() {
        this.errorCounts = {};
    }
}

// Exportar todas las utilidades
module.exports = {
    BotUtils,
    BotAnalytics,
    MessageTemplates,
    BotScheduler: new BotScheduler(Conversation),
    SimpleCache,
    MetaApiErrorHandler: new MetaApiErrorHandler()
};
import { SessionData, User } from '../interfaces';
import { MessageService } from '../services';

export interface UserPreferences {
    language: 'es' | 'en';
    responseStyle: 'formal' | 'friendly' | 'technical';
    notifications: boolean;
    quickActions: string[];
    favoriteServices: string[];
}

export interface ConversationContext {
    previousTopics: string[];
    userIntent: string;
    confidence: number;
    suggestedActions: string[];
    conversationStage: 'greeting' | 'authentication' | 'service_selection' | 'active_flow' | 'closing';
}

/**
 * Servicio para mejorar la experiencia del usuario con IA contextual
 */
export class UserExperienceService {
    private static instance: UserExperienceService;
    private messageService: MessageService;
    private userPreferences: Map<string, UserPreferences> = new Map();
    private conversationContexts: Map<string, ConversationContext> = new Map();

    private constructor() {
        this.messageService = MessageService.getInstance();
        this.initializeService();
    }

    static getInstance(): UserExperienceService {
        if (!UserExperienceService.instance) {
            UserExperienceService.instance = new UserExperienceService();
        }
        return UserExperienceService.instance;
    }

    /**
     * Analiza el contexto de la conversación y sugiere mejoras
     */
    analyzeConversationContext(user: User, message: string, session: SessionData): ConversationContext {
        const phoneNumber = user.phoneNumber;
        let context = this.conversationContexts.get(phoneNumber);

        if (!context) {
            context = this.createDefaultContext();
            this.conversationContexts.set(phoneNumber, context);
        }

        // Actualizar contexto basado en el mensaje actual
        this.updateContext(context, message, user, session);

        return context;
    }

    /**
     * Genera respuestas personalizadas basadas en el perfil del usuario
     */
    personalizeResponse(user: User, baseResponse: string): string {
        const preferences = this.getUserPreferences(user.phoneNumber);

        // Aplicar estilo de respuesta preferido
        switch (preferences.responseStyle) {
            case 'formal':
                return this.makeFormal(baseResponse);
            case 'friendly':
                return this.makeFriendly(baseResponse);
            case 'technical':
                return this.makeTechnical(baseResponse);
            default:
                return baseResponse;
        }
    }

    /**
     * Sugiere acciones rápidas basadas en el contexto
     */
    getSuggestedQuickActions(user: User, session: SessionData): string[] {
        const context = this.conversationContexts.get(user.phoneNumber);
        const preferences = this.getUserPreferences(user.phoneNumber);

        const suggestions: string[] = [];

        // Sugerencias basadas en el estado de la sesión
        if (!user.authenticated) {
            suggestions.push('🔐 Iniciar sesión', '💬 Soporte sin autenticación');
        } else {
            // Sugerencias para usuarios autenticados
            if (session.flowActive === 'sales') {
                suggestions.push('💰 Ver planes', '📞 Hablar con asesor', '📊 Comparar opciones');
            } else if (session.flowActive === 'invoices') {
                suggestions.push('💳 Pagar factura', '📋 Ver detalles', '📧 Enviar por email');
            } else {
                // Sugerencias generales
                suggestions.push(...preferences.quickActions);
            }
        }

        return suggestions.slice(0, 4); // Máximo 4 sugerencias
    }

    /**
     * Detecta la intención del usuario con IA
     */
    detectUserIntent(message: string): { intent: string; confidence: number; entities: any[] } {
        const normalizedMessage = message.toLowerCase().trim();

        // Patrones de intención (se puede expandir con ML)
        const intentPatterns = {
            'greeting': /^(hola|buenas|buenos días|buenas tardes|buenas noches|hi|hello)/,
            'payment_inquiry': /(pagar|factura|deuda|dinero|pago|cancelar deuda)/,
            'technical_support': /(problema|error|falla|no funciona|lento|caído)/,
            'sales_inquiry': /(plan|contratar|precio|oferta|servicio|internet|tv)/,
            'account_inquiry': /(cuenta|datos|información|usuario|perfil)/,
            'complaint': /(queja|reclamo|molesto|enojado|mal servicio)/,
            'goodbye': /(adiós|chao|hasta luego|gracias|bye)/
        };

        for (const [intent, pattern] of Object.entries(intentPatterns)) {
            if (pattern.test(normalizedMessage)) {
                return {
                    intent,
                    confidence: 0.8,
                    entities: this.extractEntities(message)
                };
            }
        }

        return {
            intent: 'unknown',
            confidence: 0.3,
            entities: []
        };
    }

    /**
     * Genera mensaje de bienvenida personalizado
     */
    generatePersonalizedWelcome(user: User): string {
        const preferences = this.getUserPreferences(user.phoneNumber);
        const timeOfDay = this.getTimeOfDay();

        let greeting = '';
        switch (timeOfDay) {
            case 'morning':
                greeting = '¡Buenos días!';
                break;
            case 'afternoon':
                greeting = '¡Buenas tardes!';
                break;
            case 'evening':
                greeting = '¡Buenas noches!';
                break;
        }

        if (user.authenticated) {
            return `${greeting} 😊\n\n¡Qué gusto verte de nuevo! ¿En qué puedo ayudarte hoy?`;
        } else {
            return `${greeting} 👋\n\nBienvenido a Conecta2 Telecomunicaciones. Soy tu asistente virtual.\n\n¿Necesitas ayuda con algún servicio específico?`;
        }
    }

    /**
     * Proporciona consejos contextuales
     */
    getContextualTips(user: User, session: SessionData): string[] {
        const tips: string[] = [];

        if (session.flowActive === 'sales') {
            tips.push(
                '💡 Tip: Puedes comparar todos nuestros planes escribiendo "comparar"',
                '🎯 ¿Sabías que ofrecemos descuentos en combos internet + TV?'
            );
        } else if (session.flowActive === 'support') {
            tips.push(
                '🔧 Tip: Reiniciar tu router puede resolver el 70% de problemas de conexión',
                '📱 Puedes hacer un diagnóstico rápido escribiendo "ping"'
            );
        }

        return tips;
    }

    /**
     * Actualiza las preferencias del usuario
     */
    updateUserPreferences(phoneNumber: string, preferences: Partial<UserPreferences>): void {
        const current = this.getUserPreferences(phoneNumber);
        const updated = { ...current, ...preferences };
        this.userPreferences.set(phoneNumber, updated);

        console.log(`✅ Preferencias actualizadas para ${phoneNumber}`);
    }

    private createDefaultContext(): ConversationContext {
        return {
            previousTopics: [],
            userIntent: 'unknown',
            confidence: 0,
            suggestedActions: [],
            conversationStage: 'greeting'
        };
    }

    private updateContext(context: ConversationContext, message: string, user: User, session: SessionData): void {
        // Detectar intención
        const intentAnalysis = this.detectUserIntent(message);
        context.userIntent = intentAnalysis.intent;
        context.confidence = intentAnalysis.confidence;

        // Actualizar etapa de la conversación
        if (!user.authenticated) {
            context.conversationStage = 'authentication';
        } else if (session.awaitingServiceSelection) {
            context.conversationStage = 'service_selection';
        } else if (session.flowActive) {
            context.conversationStage = 'active_flow';
        }

        // Mantener historial de temas (últimos 5)
        context.previousTopics.unshift(intentAnalysis.intent);
        context.previousTopics = context.previousTopics.slice(0, 5);
    }

    private getUserPreferences(phoneNumber: string): UserPreferences {
        return this.userPreferences.get(phoneNumber) || {
            language: 'es',
            responseStyle: 'friendly',
            notifications: true,
            quickActions: ['📋 Mis facturas', '🔧 Soporte técnico', '💰 Planes', '📞 Contactar agente'],
            favoriteServices: []
        };
    }

    private makeFormal(text: string): string {
        return text
            .replace(/¡Hola!/g, 'Buenos días/tardes')
            .replace(/😊/g, '')
            .replace(/🎉/g, '');
    }

    private makeFriendly(text: string): string {
        if (!text.includes('😊') && !text.includes('🎉')) {
            return text + ' 😊';
        }
        return text;
    }

    private makeTechnical(text: string): string {
        return text.replace(/emojis/g, '').trim();
    }

    private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    private extractEntities(message: string): any[] {
        // Implementación básica de extracción de entidades
        const entities: any[] = [];

        // Detectar números (posibles IDs de servicio, precios, etc.)
        const numbers = message.match(/\d+/g);
        if (numbers) {
            entities.push(...numbers.map(num => ({ type: 'number', value: num })));
        }

        // Detectar emails
        const emails = message.match(/\S+@\S+\.\S+/g);
        if (emails) {
            entities.push(...emails.map(email => ({ type: 'email', value: email })));
        }

        return entities;
    }

    private initializeService(): void {
        // Limpiar contextos antiguos cada hora
        setInterval(() => {
            this.cleanupOldContexts();
        }, 60 * 60 * 1000);

        console.log('🎯 UserExperienceService iniciado');
    }

    private cleanupOldContexts(): void {
        // Limpiar contextos de conversaciones inactivas
        const threshold = Date.now() - (2 * 60 * 60 * 1000); // 2 horas
        let cleaned = 0;

        for (const [phoneNumber, context] of this.conversationContexts.entries()) {
            // Si no hay actividad reciente, eliminar contexto
            // (En una implementación real, se tracking sería más sofisticado)
            if (Math.random() > 0.9) { // Placeholder para lógica de limpieza
                this.conversationContexts.delete(phoneNumber);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Limpiados ${cleaned} contextos de conversación inactivos`);
        }
    }
}

export default UserExperienceService;

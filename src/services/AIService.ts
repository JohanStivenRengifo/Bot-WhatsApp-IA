import { User } from '../interfaces';
import { AIRouter } from './ai/AIRouter';

interface ConversationContext {
    userType: 'sales_prospect' | 'technical_support' | 'general_inquiry';
    sessionHistory: Array<{
        user: string;
        ai: string;
        timestamp: Date;
        sentiment?: 'positive' | 'negative' | 'neutral';
    }>;
    customerInfo?: {
        hasService: boolean;
        serviceStatus?: string;
        lastInteraction?: Date;
        satisfactionScore?: number;
    };
}

interface AIPersonalityConfig {
    salesPersonality: {
        enthusiasm: number; // 1-10
        persuasiveness: number; // 1-10
        empathy: number; // 1-10
        professionalismo: number; // 1-10
    };
    supportPersonality: {
        patience: number; // 1-10
        technical_depth: number; // 1-10
        friendliness: number; // 1-10
        problem_solving: number; // 1-10
    };
}

export class AIService {
    private aiRouter: AIRouter;
    private conversationContexts: Map<string, ConversationContext> = new Map();
    private personality: AIPersonalityConfig;

    constructor() {
        this.aiRouter = new AIRouter();

        // Configurar personalidad del AI
        this.personality = {
            salesPersonality: {
                enthusiasm: 8,
                persuasiveness: 7,
                empathy: 9,
                professionalismo: 8
            },
            supportPersonality: {
                patience: 9,
                technical_depth: 7,
                friendliness: 8,
                problem_solving: 9
            }
        };
    }

    async getAIResponse(message: string, user: User, context?: any): Promise<string> {
        return await this.aiRouter.getAIResponse(message, user);
    }

    /**
     * Genera respuesta de ventas personalizada y persuasiva
     */
    async getSalesResponse(message: string, user: User, conversationHistory?: Array<{ user: string, ai: string }>): Promise<string> {
        const context = this.getOrCreateContext(user.phoneNumber, 'sales_prospect');

        // Construir prompt personalizado para ventas
        const salesPrompt = this.buildSalesPrompt(message, user, context, conversationHistory);

        try {
            const response = await this.aiRouter.getAIResponse(salesPrompt, user);

            // Guardar en historial
            this.updateConversationHistory(user.phoneNumber, message, response);

            return this.humanizeResponse(response, 'sales');
        } catch (error) {
            console.error('Error generando respuesta de ventas:', error);
            return this.getFallbackSalesResponse(message);
        }
    }

    /**
     * Genera respuesta de soporte técnico especializada
     */
    async getTechnicalSupportResponse(message: string, user: User, ticketContext?: any): Promise<string> {
        const context = this.getOrCreateContext(user.phoneNumber, 'technical_support');

        // Construir prompt especializado para soporte técnico
        const supportPrompt = this.buildTechnicalSupportPrompt(message, user, context, ticketContext);

        try {
            const response = await this.aiRouter.getAIResponse(supportPrompt, user);

            // Guardar en historial
            this.updateConversationHistory(user.phoneNumber, message, response);

            return this.humanizeResponse(response, 'support');
        } catch (error) {
            console.error('Error generando respuesta de soporte:', error);
            return this.getFallbackSupportResponse(message);
        }
    }

    /**
     * Analiza el sentimiento del mensaje del usuario
     */
    async analyzeSentiment(message: string): Promise<'positive' | 'negative' | 'neutral'> {
        const sentimentPrompt = `Analiza el sentimiento de este mensaje y responde solo con: positive, negative, o neutral\n\nMensaje: "${message}"`;

        try {
            const result = await this.aiRouter.getAIResponse(sentimentPrompt, {} as User);
            const sentiment = result.toLowerCase().trim();

            if (sentiment.includes('positive')) return 'positive';
            if (sentiment.includes('negative')) return 'negative';
            return 'neutral';
        } catch (error) {
            return 'neutral';
        }
    }

    /**
     * Construye prompt especializado para ventas
     */
    private buildSalesPrompt(message: string, user: User, context: ConversationContext, history?: Array<{ user: string, ai: string }>): string {
        let prompt = `Eres un gerente de ventas experto de una empresa de internet y televisión. Tu objetivo es persuadir al cliente de manera amigable y profesional para que adquiera nuestros servicios.

PERSONALIDAD DE VENTAS:
- Entusiasmo: ${this.personality.salesPersonality.enthusiasm}/10
- Persuasión: ${this.personality.salesPersonality.persuasiveness}/10  
- Empatía: ${this.personality.salesPersonality.empathy}/10
- Profesionalismo: ${this.personality.salesPersonality.professionalismo}/10

PLANES DISPONIBLES:
1. Internet 50 Mbps - $45,900/mes
2. Internet 100 Mbps - $58,900/mes  
3. Internet 200 Mbps - $78,900/mes
4. Internet 100 Mbps + TV - $89,900/mes
5. Internet 200 Mbps + TV Premium - $125,900/mes

INSTRUCCIONES:
- Sé persuasivo pero no agresivo
- Destaca beneficios específicos según las necesidades del cliente
- Usa emojis ocasionalmente para hacer la conversación más amigable
- Maneja objeciones de precio con valor agregado
- Siempre termina con una pregunta para mantener la conversación`;

        if (history && history.length > 0) {
            prompt += `\n\nHISTORIAL DE CONVERSACIÓN:\n`;
            history.slice(-3).forEach((h, i) => {
                prompt += `Cliente: ${h.user}\nTú: ${h.ai}\n\n`;
            });
        }

        prompt += `\n\nMENSAJE ACTUAL DEL CLIENTE: "${message}"\n\nRespuesta (máximo 250 palabras):`;

        return prompt;
    }

    /**
     * Construye prompt especializado para soporte técnico
     */
    private buildTechnicalSupportPrompt(message: string, user: User, context: ConversationContext, ticketContext?: any): string {
        let prompt = `Eres un especialista en soporte técnico de una empresa de internet y televisión. Tu objetivo es resolver problemas técnicos de manera eficiente y amigable.

PERSONALIDAD DE SOPORTE:
- Paciencia: ${this.personality.supportPersonality.patience}/10
- Profundidad técnica: ${this.personality.supportPersonality.technical_depth}/10
- Amabilidad: ${this.personality.supportPersonality.friendliness}/10
- Resolución de problemas: ${this.personality.supportPersonality.problem_solving}/10

SERVICIOS COMUNES:
- Internet fibra óptica (50-200 Mbps)
- Televisión digital (150+ canales)
- Servicios de soporte 24/7

TIPOS DE PROBLEMAS FRECUENTES:
- Problemas de conectividad
- Lentitud de internet
- Problemas con TV digital
- Configuración de equipos
- Facturación y pagos

INSTRUCCIONES:
- Proporciona soluciones paso a paso
- Sé empático con las frustraciones del cliente
- Ofrece múltiples opciones cuando sea posible
- Usa un lenguaje técnico apropiado pero comprensible
- Pregunta detalles específicos para diagnosticar mejor`;

        if (ticketContext) {
            prompt += `\n\nCONTEXTO DEL TICKET:
Categoría: ${ticketContext.category || 'No especificada'}
Prioridad: ${ticketContext.priority || 'Media'}
Descripción previa: ${ticketContext.description || 'No disponible'}`;
        }

        prompt += `\n\nMENSAJE ACTUAL DEL CLIENTE: "${message}"\n\nRespuesta técnica (máximo 300 palabras):`;

        return prompt;
    }

    /**
     * Humaniza las respuestas del AI
     */
    private humanizeResponse(response: string, type: 'sales' | 'support'): string {
        // Remover respuestas muy robóticas
        let humanizedResponse = response
            .replace(/Como asistente de IA/gi, '')
            .replace(/Soy un bot/gi, '')
            .replace(/No soy humano/gi, '')
            .replace(/Como AI/gi, '');

        // Agregar variabilidad humana ocasional
        const humanTouches = {
            sales: [
                '¡Perfecto! ',
                'Me alegra escuchar eso. ',
                'Excelente pregunta. ',
                'Te entiendo completamente. '
            ],
            support: [
                'Entiendo tu situación. ',
                'Vamos a resolver esto juntos. ',
                'No te preocupes, es más común de lo que piensas. ',
                'Gracias por la información. '
            ]
        };

        if (Math.random() < 0.3) { // 30% de probabilidad
            const touches = humanTouches[type];
            const randomTouch = touches[Math.floor(Math.random() * touches.length)];
            humanizedResponse = randomTouch + humanizedResponse;
        }

        return humanizedResponse;
    }

    /**
     * Obtiene o crea contexto de conversación
     */
    private getOrCreateContext(phoneNumber: string, userType: ConversationContext['userType']): ConversationContext {
        let context = this.conversationContexts.get(phoneNumber);

        if (!context) {
            context = {
                userType,
                sessionHistory: []
            };
            this.conversationContexts.set(phoneNumber, context);
        }

        return context;
    }

    /**
     * Actualiza el historial de conversación
     */
    private updateConversationHistory(phoneNumber: string, userMessage: string, aiResponse: string): void {
        const context = this.conversationContexts.get(phoneNumber);
        if (context) {
            context.sessionHistory.push({
                user: userMessage,
                ai: aiResponse,
                timestamp: new Date()
            });

            // Mantener solo los últimos 10 intercambios
            if (context.sessionHistory.length > 10) {
                context.sessionHistory = context.sessionHistory.slice(-10);
            }
        }
    }

    /**
     * Respuesta de ventas de respaldo
     */
    private getFallbackSalesResponse(message: string): string {
        const fallbackResponses = [
            '¡Hola! 😊 Me alegra que estés interesado en nuestros servicios de internet y televisión. Tenemos planes increíbles desde $45,900/mes. ¿Te gustaría conocer más detalles?',
            '¡Excelente! 🌟 Ofrecemos internet de alta velocidad con fibra óptica desde 50 Mbps hasta 200 Mbps. ¿Qué velocidad necesitas para tu hogar?',
            'Perfecto 👍 Nuestros planes incluyen instalación gratuita y soporte 24/7. ¿Prefieres solo internet o también televisión?'
        ];

        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    /**
     * Respuesta de soporte de respaldo
     */
    private getFallbackSupportResponse(message: string): string {
        const fallbackResponses = [
            'Entiendo tu situación y estoy aquí para ayudarte. 🛠️ ¿Podrías contarme más detalles sobre el problema que estás experimentando?',
            'No te preocupes, vamos a resolver esto juntos. 💪 Para ayudarte mejor, ¿podrías decirme qué tipo de servicio tienes y cuál es el problema específico?',
            'Gracias por contactarnos. 🤝 Para brindarte la mejor solución, necesito algunos detalles: ¿es un problema de internet, televisión o ambos?'
        ];

        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    /**
     * Limpia contexto de conversación
     */
    clearConversationContext(phoneNumber: string): void {
        this.conversationContexts.delete(phoneNumber);
    }

    /**
     * Obtiene estadísticas de conversaciones
     */
    getConversationStats(): {
        totalConversations: number;
        salesConversations: number;
        supportConversations: number;
        averageLength: number;
    } {
        let salesCount = 0;
        let supportCount = 0;
        let totalMessages = 0;

        this.conversationContexts.forEach(context => {
            if (context.userType === 'sales_prospect') salesCount++;
            if (context.userType === 'technical_support') supportCount++;
            totalMessages += context.sessionHistory.length;
        });

        return {
            totalConversations: this.conversationContexts.size,
            salesConversations: salesCount,
            supportConversations: supportCount,
            averageLength: this.conversationContexts.size > 0 ? totalMessages / this.conversationContexts.size : 0
        };
    }

    async getServiceStatus(): Promise<{ [key: string]: boolean }> {
        return await this.aiRouter.getServiceStatus();
    }

    getCurrentConfiguration(): { primary: string; fallback: string; available: string[] } {
        return this.aiRouter.getCurrentConfiguration();
    }
}
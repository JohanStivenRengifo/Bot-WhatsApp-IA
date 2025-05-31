import { config } from '../../config';
import { User, IAIService, AIResponse } from '../../interfaces';
import { OpenAIService } from './OpenAIService';
import { GeminiService } from './GeminiService';

export class AIRouter {
    private services: Map<string, IAIService>;
    private primaryService: string;
    private fallbackService: string;

    constructor() {
        this.services = new Map();
        this.services.set('openai', new OpenAIService());
        this.services.set('gemini', new GeminiService());
        
        this.primaryService = config.ai.primaryService;
        this.fallbackService = config.ai.fallbackService;
    }

    async getAIResponse(message: string, user: User): Promise<string> {
        try {
            // Try primary service first
            const primaryResponse = await this.tryService(this.primaryService, message, user);
            if (primaryResponse.success) {
                console.log(`✅ AI Response from ${primaryResponse.service}: Success`);
                return primaryResponse.message;
            }

            console.warn(`⚠️ Primary AI service (${this.primaryService}) failed: ${primaryResponse.error}`);

            // Try fallback service
            const fallbackResponse = await this.tryService(this.fallbackService, message, user);
            if (fallbackResponse.success) {
                console.log(`✅ AI Response from ${fallbackResponse.service} (fallback): Success`);
                return fallbackResponse.message;
            }

            console.error(`❌ Fallback AI service (${this.fallbackService}) also failed: ${fallbackResponse.error}`);

            // If both services fail, return a default message
            return this.getDefaultResponse();

        } catch (error) {
            console.error('AI Router error:', error);
            return this.getDefaultResponse();
        }
    }

    private async tryService(serviceName: string, message: string, user: User): Promise<AIResponse> {
        const service = this.services.get(serviceName);
        
        if (!service) {
            return {
                success: false,
                message: '',
                service: serviceName,
                error: `Service ${serviceName} not found`
            };
        }

        // Check if service is available
        const isAvailable = await service.isAvailable();
        if (!isAvailable) {
            return {
                success: false,
                message: '',
                service: serviceName,
                error: `Service ${serviceName} is not available`
            };
        }

        // Generate response
        return await service.generateResponse(message, user);
    }

    private getDefaultResponse(): string {
        const defaultResponses = [
            'No pude procesar tu consulta en este momento. Escribe "menu" para ver las opciones disponibles o "agente" para hablar con soporte.',
            'Disculpa, tengo dificultades técnicas. Escribe "menu" para ver las opciones o "agente" para contactar a un representante.',
            'Lo siento, no puedo ayudarte con eso ahora. Escribe "menu" para ver qué puedo hacer o "agente" para hablar con una persona.',
            'Tengo problemas para procesar tu mensaje. Escribe "menu" para ver las opciones disponibles o "agente" para asistencia humana.'
        ];

        // Return a random default response
        const randomIndex = Math.floor(Math.random() * defaultResponses.length);
        return defaultResponses[randomIndex];
    }

    async getServiceStatus(): Promise<{ [key: string]: boolean }> {
        const status: { [key: string]: boolean } = {};
        
        for (const [name, service] of this.services) {
            try {
                status[name] = await service.isAvailable();
            } catch (error) {
                status[name] = false;
            }
        }

        return status;
    }

    getCurrentConfiguration(): { primary: string; fallback: string; available: string[] } {
        return {
            primary: this.primaryService,
            fallback: this.fallbackService,
            available: Array.from(this.services.keys())
        };
    }
}
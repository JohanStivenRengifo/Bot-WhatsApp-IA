import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { User, IAIService, AIResponse } from '../../interfaces';

export class GeminiService implements IAIService {
    public readonly name = 'Gemini';
    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        if (config.ai.gemini.apiKey) {
            this.genAI = new GoogleGenerativeAI(config.ai.gemini.apiKey);
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!config.ai.gemini.apiKey || !this.genAI) {
            return false;
        }

        try {
            // Test the API with a simple request
            const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
            await model.generateContent('test');
            return true;
        } catch (error) {
            console.warn(`Gemini service unavailable:`, error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }

    async generateResponse(message: string, user: User): Promise<AIResponse> {
        if (!this.genAI) {
            return {
                success: false,
                message: '',
                service: this.name,
                error: 'Gemini API key not configured'
            };
        }

        try {
            const prompt = this.buildPrompt(message);
            const model = this.genAI.getGenerativeModel({
                model: "gemini-pro",
                generationConfig: {
                    maxOutputTokens: 150,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const aiMessage = response.text().trim();

            return {
                success: true,
                message: aiMessage,
                service: this.name
            };
        } catch (error) {
            console.error('Gemini service error:', error);

            let errorMessage = 'Error interno del servicio de IA';
            if (error instanceof Error) {
                if (error.message.includes('API_KEY_INVALID')) {
                    errorMessage = 'Clave de API de Gemini inválida';
                } else if (error.message.includes('QUOTA_EXCEEDED')) {
                    errorMessage = 'Límite de uso de Gemini alcanzado';
                } else if (error.message.includes('timeout')) {
                    errorMessage = 'Timeout en la conexión con Gemini';
                } else if (error.message.includes('SAFETY')) {
                    errorMessage = 'Contenido bloqueado por filtros de seguridad';
                }
            }

            return {
                success: false,
                message: '',
                service: this.name,
                error: errorMessage
            };
        }
    }

    private buildPrompt(message: string): string {
        return `Eres un asistente de soporte técnico para Conecta2 Telecomunicaciones SAS, una empresa de internet en Colombia. 
Responde de manera amigable, profesional y concisa.

Instrucciones:
- Responde en español
- Máximo 200 caracteres
- Sé específico y útil
- Si el usuario escribe "ayuda", muestra las principales opciones disponibles
- Si es una consulta técnica compleja, sugiere crear un ticket usando "ticket"
- Mantén un tono profesional pero cercano
- Si el usuario necesita atención humana, sugiérele escribir "asesor"

Cliente: ${message}

Respuesta:`;
    }
}
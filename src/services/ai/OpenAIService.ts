import axios from 'axios';
import { config } from '../../config';
import { User, IAIService, AIResponse } from '../../interfaces';

export class OpenAIService implements IAIService {
    public readonly name = 'OpenAI';

    async isAvailable(): Promise<boolean> {
        if (!config.ai.openai.apiKey) {
            return false;
        }

        try {
            // Test the API with a simple request
            await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            }, {
                headers: {
                    'Authorization': `Bearer ${config.ai.openai.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return true;
        } catch (error) {
            console.warn(`OpenAI service unavailable:`, error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }

    async generateResponse(message: string, user: User): Promise<AIResponse> {
        try {
            const prompt = this.buildPrompt(message);

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150,
                temperature: 0.7,
                timeout: 10000
            }, {
                headers: {
                    'Authorization': `Bearer ${config.ai.openai.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiMessage = response.data.choices[0].message.content.trim();

            return {
                success: true,
                message: aiMessage,
                service: this.name
            };
        } catch (error) {
            console.error('OpenAI service error:', error);

            let errorMessage = 'Error interno del servicio de IA';
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    errorMessage = 'Error de autenticación con OpenAI';
                } else if (error.response?.status === 429) {
                    errorMessage = 'Límite de uso de OpenAI alcanzado';
                } else if (error.code === 'ECONNABORTED') {
                    errorMessage = 'Timeout en la conexión con OpenAI';
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

    /**
     * Analiza una imagen usando OpenAI Vision API
     */
    async analyzeImage(imageDataUrl: string, prompt: string): Promise<AIResponse> {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageDataUrl,
                                    detail: 'high'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.1
            }, {
                headers: {
                    'Authorization': `Bearer ${config.ai.openai.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const aiMessage = response.data.choices[0].message.content.trim();

            return {
                success: true,
                message: aiMessage,
                service: this.name
            };
        } catch (error) {
            console.error('OpenAI Vision service error:', error);

            let errorMessage = 'Error interno del servicio de análisis de imagen';
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    errorMessage = 'Error de autenticación con OpenAI Vision';
                } else if (error.response?.status === 429) {
                    errorMessage = 'Límite de uso de OpenAI Vision alcanzado';
                } else if (error.response?.status === 400) {
                    errorMessage = 'Imagen no válida o formato no soportado';
                } else if (error.code === 'ECONNABORTED') {
                    errorMessage = 'Timeout en la conexión con OpenAI Vision';
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
- Si el usuario escribe "ayuda", muestra las principales opciones disponibles:
  * Test de conexión (escribe "ping")
  * Consultar factura (escribe "factura")
  * Crear ticket (escribe "ticket")
  * Consultar deuda (escribe "deuda")
  * Puntos de pago (escribe "puntos_pago")
  * Cambiar contraseña (escribe "cambiar_clave")
  * Mejorar plan (escribe "mejorar_plan")
- Si es una consulta técnica compleja, sugiere crear un ticket usando "ticket"
- Mantén un tono profesional pero cercano
- Si el usuario necesita atención humana, sugiérele escribir "asesor"

Cliente: ${message}

Respuesta:`;
    }
}
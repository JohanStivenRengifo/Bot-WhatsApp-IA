import { AzureOpenAI } from 'openai';
import { config } from '../config';

export interface AIResponse {
    success: boolean;
    message: string;
    error?: string;
    modelUsed?: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class AzureOpenAIService {
    private client: AzureOpenAI;
    private readonly modelName: string;
    private readonly deploymentName: string;

    constructor() {
        if (!config.azureOpenAI.endpoint || !config.azureOpenAI.apiKey) {
            throw new Error('Azure OpenAI credentials not configured');
        }

        const options = {
            endpoint: config.azureOpenAI.endpoint,
            apiKey: config.azureOpenAI.apiKey,
            deployment: config.azureOpenAI.deploymentName,
            apiVersion: config.azureOpenAI.apiVersion
        };

        this.client = new AzureOpenAI(options);
        this.modelName = config.azureOpenAI.modelName;
        this.deploymentName = config.azureOpenAI.deploymentName;

        console.log('✅ Azure OpenAI Service initialized successfully');
    }

    /**
     * Envía un mensaje simple al modelo
     */
    async sendMessage(message: string, systemPrompt?: string): Promise<AIResponse> {
        try {
            const messages: ChatMessage[] = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            messages.push({ role: 'user', content: message });

            const response = await this.client.chat.completions.create({
                messages, model: this.modelName,
                max_tokens: 8192,
                temperature: 0.7,
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No content in response');
            }

            return {
                success: true,
                message: content,
                modelUsed: response.model || this.modelName
            };

        } catch (error) {
            console.error('Error in Azure OpenAI Service:', error);
            return {
                success: false,
                message: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Envía una conversación con múltiples mensajes
     */
    async sendConversation(messages: ChatMessage[]): Promise<AIResponse> {
        try {
            const response = await this.client.chat.completions.create({
                messages,
                model: this.modelName,
                max_tokens: 8192,
                temperature: 0.7,
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No content in response');
            }

            return {
                success: true,
                message: content,
                modelUsed: response.model || this.modelName
            };

        } catch (error) {
            console.error('Error in Azure OpenAI Service conversation:', error);
            return {
                success: false,
                message: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Analiza una imagen con visión artificial
     */
    async analyzeImage(imageData: string, prompt: string): Promise<AIResponse> {
        try {
            const messages: ChatMessage[] = [
                {
                    role: 'user',
                    content: `${prompt}\n\nImagen: ${imageData}`
                }
            ]; const response = await this.client.chat.completions.create({
                messages,
                model: this.modelName,
                max_tokens: 4096,
                temperature: 0.3, // Temperatura más baja para análisis más preciso
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No content in response');
            }

            return {
                success: true,
                message: content,
                modelUsed: response.model || this.modelName
            };

        } catch (error) {
            console.error('Error in Azure OpenAI image analysis:', error);
            return {
                success: false,
                message: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }    /**
     * Genera respuesta de ventas personalizada con planes específicos
     */
    async getSalesResponse(userMessage: string, plans: any, context: string): Promise<AIResponse> {
        const systemPrompt = `
Eres Andrea, asesora comercial experta de Conecta2 Telecomunicaciones (Piendamó, Cauca, Colombia).
Tu personalidad es amigable, profesional, entusiasta y orientada a resultados.

PLANES DISPONIBLES (ÚNICOS, NO INVENTES OTROS):

INTERNET FIBRA ÓPTICA:
${plans.internetPlans.map((plan: any) =>
            `• ${plan.name}: $${plan.price.toLocaleString('es-CO')} - ${plan.description} (${plan.speed})`
        ).join('\n')}

TELEVISIÓN:
${plans.tvPlans.map((plan: any) =>
            `• ${plan.name}: $${plan.price.toLocaleString('es-CO')} - ${plan.description}`
        ).join('\n')}

COMBOS CON DESCUENTO ESPECIAL:
${plans.comboPlan.map((combo: any) =>
            `• ${combo.name}: ${combo.description} = $${combo.comboPrice.toLocaleString('es-CO')} (AHORRO $${combo.discount.toLocaleString('es-CO')})`
        ).join('\n')}

REGLAS IMPORTANTES:
✅ SOLO menciona estos planes exactos, con precios exactos
✅ Sé conversacional, no robótica
✅ Enfócate en beneficios según el uso mencionado por el cliente
✅ Sugiere combos cuando sea apropiado (más ahorro)
✅ Si preguntan sobre instalación/contratación, menciona que puedes crear un ticket
✅ Si no sabes algo específico, derívalo a un asesor humano
✅ Mantén respuestas concisas pero completas
✅ Usa emojis moderadamente para ser más amigable
❌ NO inventes planes, precios o promociones
❌ NO des información técnica que no tengas

CONTEXTO ACTUAL:
${context}

Responde como Andrea, enfocándote en ayudar al cliente a encontrar el plan perfecto para sus necesidades.
`;

        return await this.sendMessage(userMessage, systemPrompt);
    }

    /**
     * Procesa análisis de comprobante de pago
     */
    async analyzePaymentReceipt(imageData: string): Promise<AIResponse> {
        const prompt = `
Analiza esta imagen de comprobante de pago y extrae la siguiente información:

1. MONTO: Cantidad pagada (número)
2. FECHA: Fecha de la transacción (formato DD/MM/YYYY)
3. NÚMERO DE CUENTA: Cuenta destino del pago
4. BANCO: Nombre del banco o entidad financiera
5. NÚMERO DE REFERENCIA: Código de transacción o referencia
6. MÉTODO DE PAGO: Tipo de transacción (transferencia, depósito, etc.)

CUENTAS VÁLIDAS PARA VERIFICAR:
- BANCOLOMBIA: Cuenta 26100006596, Convenio 94375
- NEQUI: 3242156679
- DAVIVIENDA: 0488403242917

Responde SOLO con un JSON con esta estructura:
{
  "amount": numero_o_null,
  "date": "DD/MM/YYYY"_o_null,
  "accountNumber": "numero"_o_null,
  "bank": "nombre_banco"_o_null,
  "referenceNumber": "referencia"_o_null,
  "paymentMethod": "metodo"_o_null,
  "confidence": 0.0_a_1.0,
  "imageQuality": "excellent|good|fair|poor"
}

Si no puedes leer claramente algún dato, usa null.
`;

        return await this.analyzeImage(imageData, prompt);
    }

    /**
     * Verifica el estado del servicio
     */
    async getServiceStatus() {
        try {
            // Prueba simple para verificar conectividad
            const testResponse = await this.sendMessage('Test connection', 'Respond with "OK" if you receive this message.');

            return {
                status: testResponse.success ? 'active' : 'error',
                service: 'Azure OpenAI',
                endpoint: config.azureOpenAI.endpoint,
                model: this.modelName,
                deployment: this.deploymentName,
                lastTest: new Date().toISOString(),
                error: testResponse.error
            };
        } catch (error) {
            return {
                status: 'error',
                service: 'Azure OpenAI',
                endpoint: config.azureOpenAI.endpoint,
                model: this.modelName,
                deployment: this.deploymentName,
                lastTest: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Obtiene la configuración actual
     */
    getCurrentConfiguration() {
        return {
            service: 'Azure OpenAI',
            endpoint: config.azureOpenAI.endpoint.replace(config.azureOpenAI.apiKey, '***'),
            model: this.modelName,
            deployment: this.deploymentName,
            apiVersion: config.azureOpenAI.apiVersion,
            maxTokens: 8192,
            temperature: 0.7
        };
    }
}

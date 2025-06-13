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
    }

    /**
     * Genera respuesta de ventas personalizada
     */
    async getSalesResponse(userMessage: string, context: any): Promise<AIResponse> {
        const systemPrompt = `
Eres un asistente de ventas especializado para Conecta2 Telecomunicaciones. 
Tu objetivo es ayudar a los clientes con consultas sobre planes de internet, TV y combos.

INFORMACIÓN DE PLANES:
- Internet 30 Mbps: $40,000 - Ideal para uso básico y navegación
- Internet 50 Mbps: $50,000 - Perfecto para familias y trabajo remoto  
- Internet 60 Mbps: $60,000 - Excelente para gaming y streaming
- Internet 70 Mbps: $68,000 - Velocidad premium para empresas
- Internet 80 Mbps: $75,000 - Ultra velocidad para uso intensivo
- Internet 100 Mbps: $80,000 - Máxima velocidad para hogares

TV HD: $40,000 - +85 Canales en HD

COMBOS CON DESCUENTO:
- Combo Básico: 30 Mbps + TV HD = $60,000 (ahorro $20,000)
- Combo Familiar: 50 Mbps + TV HD = $70,000 (ahorro $20,000)  
- Combo Premium: 100 Mbps + TV HD = $100,000 (ahorro $20,000)

INSTRUCCIONES:
- Sé amable, profesional y entusiasta
- Enfócate en los beneficios de cada plan
- Sugiere el combo más adecuado según las necesidades
- Mantén respuestas concisas pero informativas
- Si no tienes información específica, ofrece contactar a un asesor
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

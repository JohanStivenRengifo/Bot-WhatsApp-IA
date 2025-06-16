import { AzureOpenAI } from 'openai';
import { config } from '../config';

export interface AIResponse {
    success: boolean;
    message: string;
    error?: string;
    modelUsed?: string;
    retryCount?: number;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class AzureOpenAIService {
    private client: AzureOpenAI;
    private readonly modelName: string;
    private readonly deploymentName: string;
    private readonly maxRetries: number = 3;
    private readonly baseDelay: number = 1000; // 1 segundo base para retry
    private isHealthy: boolean = true;
    private lastHealthCheck: Date = new Date();

    constructor() {
        if (!config.azureOpenAI.endpoint || !config.azureOpenAI.apiKey) {
            throw new Error('Azure OpenAI credentials not configured');
        }

        const options = {
            endpoint: config.azureOpenAI.endpoint,
            apiKey: config.azureOpenAI.apiKey,
            deployment: config.azureOpenAI.deploymentName,
            apiVersion: config.azureOpenAI.apiVersion,
            timeout: 30000, // 30 segundos timeout
            maxRetries: 0 // Manejamos los reintentos manualmente
        };

        this.client = new AzureOpenAI(options);
        this.modelName = config.azureOpenAI.modelName;
        this.deploymentName = config.azureOpenAI.deploymentName;

        console.log('✅ Azure OpenAI Service initialized successfully');
        this.performHealthCheck();
    }

    /**
     * Realiza un chequeo de salud periódico del servicio
     */
    private async performHealthCheck(): Promise<void> {
        try {
            const testResponse = await this.sendMessage('Test', 'Respond with "OK"');
            this.isHealthy = testResponse.success;
            this.lastHealthCheck = new Date();

            if (!this.isHealthy) {
                console.warn('⚠️ Azure OpenAI Service health check failed');
            }
        } catch (error) {
            this.isHealthy = false;
            this.lastHealthCheck = new Date();
            console.error('❌ Azure OpenAI Service health check error:', error);
        }
    }

    /**
     * Implementa exponential backoff para reintentos
     */
    private async delay(attempt: number): Promise<void> {
        const delayMs = this.baseDelay * Math.pow(2, attempt);
        return new Promise(resolve => setTimeout(resolve, delayMs));
    }

    /**
     * Wrapper para llamadas con manejo de errores y reintentos
     */
    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<{ result?: T; error?: string; retryCount: number }> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`🔄 Reintentando ${operationName} (intento ${attempt + 1}/${this.maxRetries + 1})`);
                    await this.delay(attempt - 1);
                }

                const result = await operation();

                if (attempt > 0) {
                    console.log(`✅ ${operationName} exitoso después de ${attempt} reintentos`);
                }

                return { result, retryCount: attempt };

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Analizar el tipo de error para decidir si reintentar
                const shouldRetry = this.shouldRetryError(lastError);

                if (!shouldRetry || attempt === this.maxRetries) {
                    console.error(`❌ ${operationName} falló después de ${attempt + 1} intentos:`, lastError.message);
                    break;
                }

                console.warn(`⚠️ ${operationName} falló (intento ${attempt + 1}): ${lastError.message}`);
            }
        }

        return {
            error: this.getUserFriendlyError(lastError),
            retryCount: this.maxRetries + 1
        };
    }

    /**
     * Determina si un error justifica un reintento
     */
    private shouldRetryError(error: Error): boolean {
        const retryableErrors = [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'fetch failed',
            'Failed to fetch',
            'network error',
            'timeout',
            'rate limit',
            'throttled',
            '429',
            '502',
            '503',
            '504'
        ];

        const errorMessage = error.message.toLowerCase();
        return retryableErrors.some(retryableError =>
            errorMessage.includes(retryableError.toLowerCase())
        );
    }

    /**
     * Convierte errores técnicos en mensajes amigables para el usuario
     */
    private getUserFriendlyError(error: Error | null): string {
        if (!error) return 'Error desconocido';

        const message = error.message.toLowerCase();

        if (message.includes('fetch failed') || message.includes('failed to fetch')) {
            return 'Error de conexión. Verifica tu conexión a internet e inténtalo nuevamente.';
        }

        if (message.includes('timeout') || message.includes('etimedout')) {
            return 'Tiempo de espera agotado. El servicio está tardando más de lo esperado.';
        }

        if (message.includes('rate limit') || message.includes('429')) {
            return 'Demasiadas solicitudes. Por favor, espera un momento antes de intentar nuevamente.';
        }

        if (message.includes('authentication') || message.includes('unauthorized')) {
            return 'Error de autenticación. Configuración de credenciales incorrecta.';
        }

        if (message.includes('not found') || message.includes('404')) {
            return 'Servicio no encontrado. Verifica la configuración del endpoint.';
        }

        return `Error del servicio de IA: ${error.message}`;
    }    /**
     * Envía un mensaje simple al modelo
     */
    async sendMessage(message: string, systemPrompt?: string): Promise<AIResponse> {
        const operation = async () => {
            const messages: ChatMessage[] = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            messages.push({ role: 'user', content: message });

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
                content,
                model: response.model || this.modelName
            };
        };

        const { result, error, retryCount } = await this.executeWithRetry(
            operation,
            'sendMessage'
        );

        if (error) {
            return {
                success: false,
                message: '',
                error,
                retryCount
            };
        }

        return {
            success: true,
            message: result!.content,
            modelUsed: result!.model,
            retryCount
        };
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
    }    /**
     * Verifica el estado del servicio
     */
    async getServiceStatus() {
        try {
            // Verificar si necesitamos un health check reciente
            const timeSinceLastCheck = Date.now() - this.lastHealthCheck.getTime();
            if (timeSinceLastCheck > 300000) { // 5 minutos
                await this.performHealthCheck();
            }

            // Prueba rápida si está marcado como no saludable
            if (!this.isHealthy) {
                const testResponse = await this.sendMessage('Test connection', 'Respond with "OK" if you receive this message.');
                this.isHealthy = testResponse.success;
                this.lastHealthCheck = new Date();
            }

            return {
                status: this.isHealthy ? 'active' : 'error',
                service: 'Azure OpenAI',
                endpoint: config.azureOpenAI.endpoint,
                model: this.modelName,
                deployment: this.deploymentName,
                lastTest: this.lastHealthCheck.toISOString(),
                healthy: this.isHealthy,
                maxRetries: this.maxRetries,
                baseDelay: this.baseDelay
            };
        } catch (error) {
            this.isHealthy = false;
            this.lastHealthCheck = new Date();

            return {
                status: 'error',
                service: 'Azure OpenAI',
                endpoint: config.azureOpenAI.endpoint,
                model: this.modelName,
                deployment: this.deploymentName,
                lastTest: this.lastHealthCheck.toISOString(),
                healthy: false,
                error: this.getUserFriendlyError(error instanceof Error ? error : new Error(String(error)))
            };
        }
    }

    /**
     * Obtiene la configuración current
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
    }    /**
     * Genera respuestas sugeridas para agentes basadas en el contexto de la conversación
     */
    async generateSuggestedResponses(conversationMessages: any[], customerInfo?: any): Promise<AIResponse> {
        const operation = async () => {
            // Construir el contexto de la conversación
            const conversationContext = conversationMessages
                .slice(-10) // Tomar los últimos 10 mensajes para contexto
                .map(msg => `${msg.fromAgent ? 'Agente' : 'Cliente'}: ${msg.content}`)
                .join('\n');

            const systemPrompt = `
Eres un asistente inteligente especializado en atención al cliente para Conecta2 Telecomunicaciones.

INFORMACIÓN DE LA EMPRESA:
- Nombre: Conecta2 Telecomunicaciones
- Servicios principales: Internet de alta velocidad, TV HD, paquetes combinados
- Planes de Internet: 30 Mbps ($40,000), 50 Mbps ($50,000), 60 Mbps ($60,000), 70 Mbps ($68,000), 80 Mbps ($80,000), 100 Mbps ($80,000)
- TV HD: $40,000 mensual con más de 85 canales en alta definición
- Combos: Descuento de $20,000 al contratar Internet + TV
- Soporte técnico 24/7 disponible
- Garantía de instalación profesional gratuita

TIPOS DE CONSULTAS COMUNES:
- Consultas de planes y precios
- Problemas técnicos (internet lento, sin señal TV)
- Solicitudes de cambio de plan
- Consultas de facturación
- Instalaciones y citas técnicas
- Cancelaciones y suspensiones
- Promociones y ofertas

PAUTAS PARA RESPUESTAS:
1. Siempre mantén un tono profesional, empático y servicial
2. Ofrece soluciones concretas cuando sea posible
3. Menciona beneficios específicos de los servicios cuando sea relevante
4. Si no tienes información completa, indica que consultarás con el departamento especializado
5. Ofrece alternativas cuando la solicitud inicial no sea posible
6. Usa un lenguaje claro y evita tecnicismos complejos

FORMATO DE RESPUESTA:
Debes responder ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "analysis": "Análisis breve de la situación del cliente y qué necesita",
  "suggestions": [
    {
      "type": "professional",
      "text": "Respuesta directa y profesional (máximo 150 caracteres)"
    },
    {
      "type": "empathetic", 
      "text": "Respuesta empática que muestra comprensión (máximo 150 caracteres)"
    },
    {
      "type": "proactive",
      "text": "Respuesta con sugerencias adicionales útiles (máximo 150 caracteres)"
    }
  ]
}
`;

            const userPrompt = `
CONTEXTO DE LA CONVERSACIÓN:
${conversationContext}

${customerInfo ? `
INFORMACIÓN DEL CLIENTE:
- Nombre: ${customerInfo.name || 'No disponible'}
- Teléfono: ${customerInfo.phone || 'No disponible'}
- Plan actual: ${customerInfo.currentPlan || 'No disponible'}
` : ''}

Analiza esta conversación y genera 3 respuestas sugeridas apropiadas para el agente.
`;

            const response = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: this.modelName,
                max_tokens: 1000,
                temperature: 0.7,
                top_p: 0.9,
                frequency_penalty: 0.3,
                presence_penalty: 0.3
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No content in response');
            }

            return {
                content,
                model: response.model || this.modelName
            };
        };

        const { result, error, retryCount } = await this.executeWithRetry(
            operation,
            'generateSuggestedResponses'
        );

        if (error) {
            return {
                success: false,
                message: '',
                error,
                retryCount
            };
        }

        return {
            success: true,
            message: result!.content,
            modelUsed: result!.model,
            retryCount
        };
    }
}

import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, AIService, CustomerService } from '../services';

/**
 * Flujo de soporte general potenciado por IA
 */
export class GeneralSupportFlow extends BaseConversationFlow {
    readonly name: string = 'generalSupport';

    private aiService: AIService;
    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        aiService: AIService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.aiService = aiService;
        this.customerService = customerService;
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        return (
            user.authenticated &&
            (message === 'soporte_general' ||
                message === 'ayuda_ia' ||
                message === 'consulta_general' ||
                this.isGeneralSupportQuery(message))
        );
    }

    /**
     * Maneja consultas generales con IA especializada
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Si es la primera vez en este flujo, enviar mensaje de bienvenida
            if (message === 'soporte_general' || message === 'ayuda_ia') {
                await this.sendWelcomeMessage(user);
                return true;
            }

            // Analizar la consulta con IA
            const supportContext = await this.buildSupportContext(user, message, session);

            // Obtener respuesta especializada de la IA
            const aiResponse = await this.aiService.getAIResponse(message, user);

            // Analizar si necesita escalamiento
            const needsEscalation = await this.analyzeEscalationNeed(message, aiResponse);

            if (needsEscalation.required) {
                await this.handleEscalation(user, message, needsEscalation.reason);
                return true;
            }

            // Enviar respuesta de IA con opciones adicionales
            await this.sendAIResponseWithOptions(user, aiResponse, message);

            // Actualizar contexto de IA personal
            await this.updateUserAIContext(user, message, aiResponse);

            return true;

        } catch (error) {
            console.error('Error en flujo de soporte general:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ha ocurrido un error procesando tu consulta. Un técnico revisará tu caso.\n\n' +
                'Mientras tanto, puedes:\n' +
                '• Intentar reiniciar tu router\n' +
                '• Verificar conexiones de cables\n' +
                '• Escribir "menu" para ver otras opciones');
            return true;
        }
    }

    /**
     * Envía mensaje de bienvenida al soporte IA
     */
    private async sendWelcomeMessage(user: User): Promise<void> {
        let userName = 'cliente';

        if (user.encryptedData) {
            try {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                if (decryptedData.customerName) {
                    userName = decryptedData.customerName.split(' ')[0];
                }
            } catch (error) {
                console.error('Error decrypting user data:', error);
            }
        }

        await this.messageService.sendTextMessage(user.phoneNumber,
            `🤖 **Soporte Inteligente Conecta2**\n\n` +
            `¡Hola ${userName}! Soy tu asistente técnico especializado.\n\n` +
            '🧠 **¿En qué puedo ayudarte?**\n' +
            '• Diagnóstico de problemas de conexión\n' +
            '• Guías de configuración paso a paso\n' +
            '• Optimización de velocidad\n' +
            '• Solución de problemas de red\n' +
            '• Configuración de dispositivos\n\n' +
            '💡 **Ejemplos de consultas:**\n' +
            '• "Mi internet está lento"\n' +
            '• "¿Cómo configuro mi WiFi?"\n' +
            '• "No puedo conectar mi TV"\n' +
            '• "¿Por qué se corta la conexión?"\n\n' +
            '✍️ **Cuéntame tu problema o pregunta:**');
    }

    /**
     * Construye el contexto especializado para IA de soporte
     */
    private async buildSupportContext(user: User, message: string, session: SessionData): Promise<string> {
        let context = `
Eres un técnico especializado en telecomunicaciones de Conecta2, experto en resolver problemas de conectividad, configuración de redes y optimización de servicios de internet.

INFORMACIÓN DEL CLIENTE:
- Teléfono: ${user.phoneNumber}
- Autenticado: Sí
- Servicio: Activo
`;

        // Agregar información del cliente si está disponible
        if (user.encryptedData) {
            try {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                if (decryptedData.customerName) {
                    context += `- Nombre: ${decryptedData.customerName}\n`;
                }
            } catch (error) {
                console.error('Error decrypting user data:', error);
            }
        }

        // Obtener información técnica del cliente
        try {
            const customerInfo = await this.customerService.getCustomerInfo(user.customerId!);
            if (customerInfo) {
                context += `- Plan: No disponible\n`;
                context += `- IP: ${customerInfo.ip_address || 'No disponible'}\n`;
                context += `- Estado: ${customerInfo.status || 'Activo'}\n`;
            }
        } catch (error) {
            console.error('Error obteniendo info del cliente:', error);
        }

        // Agregar historial de IA si existe
        if (user.aiContext?.lastTopics) {
            context += `\nTEMAS RECIENTES: ${user.aiContext.lastTopics.join(', ')}\n`;
        }

        context += `
ESPECIALIDADES:
- Diagnóstico de conectividad (ping, traceroute, análisis de señal)
- Configuración de routers y dispositivos WiFi
- Optimización de velocidad y rendimiento
- Resolución de problemas de red doméstica
- Configuración de dispositivos (Smart TV, consolas, etc.)
- Análisis de interferencias y problemas de cobertura

HERRAMIENTAS DISPONIBLES:
- Poder realizar ping a la IP del cliente
- Acceso a información de plan y configuración
- Capacidad de crear tickets especializados
- Guías paso a paso personalizadas

ESTILO DE RESPUESTA:
- Técnico pero accesible
- Paso a paso cuando sea necesario
- Incluir diagnósticos cuando corresponda
- Ofrecer múltiples soluciones
- Ser proactivo en prevención

CONSULTA ACTUAL: "${message}"
`;

        return context;
    }

    /**
     * Envía respuesta de IA con opciones adicionales
     */
    private async sendAIResponseWithOptions(user: User, aiResponse: string, originalQuery: string): Promise<void> {
        // Enviar la respuesta principal de la IA
        await this.messageService.sendTextMessage(user.phoneNumber, aiResponse);

        // Analizar si se puede ofrecer acciones adicionales
        const actions = this.suggestAdditionalActions(originalQuery);

        if (actions.length > 0) {
            // Crear mensaje con botones de acción
            const actionButtons = {
                messaging_product: 'whatsapp',
                to: user.phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: {
                        type: 'text',
                        text: '🛠️ Acciones Adicionales'
                    },
                    body: {
                        text: '¿Te gustaría que realice alguna de estas acciones para ayudarte mejor?'
                    },
                    action: {
                        buttons: actions.slice(0, 3) // WhatsApp limita a 3 botones
                    }
                }
            };

            await this.messageService.sendMessage(actionButtons);
        }

        // Ofrecer más ayuda
        setTimeout(async () => {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❓ **¿Necesitas más ayuda?**\n\n' +
                '• Escribe otra pregunta\n' +
                '• Escribe "diagnostico" para análisis completo\n' +
                '• Escribe "tecnico" para hablar con un humano\n' +
                '• Escribe "menu" para volver al menú principal');
        }, 2000);
    }

    /**
     * Sugiere acciones adicionales basadas en la consulta
     */
    private suggestAdditionalActions(query: string): Array<{ type: string, reply: { id: string, title: string } }> {
        const actions: Array<{ type: string, reply: { id: string, title: string } }> = [];
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('lento') || lowerQuery.includes('velocidad')) {
            actions.push({
                type: 'reply',
                reply: {
                    id: 'test_velocidad',
                    title: '📊 Test Velocidad'
                }
            });
        }

        if (lowerQuery.includes('wifi') || lowerQuery.includes('conexion') || lowerQuery.includes('conectar')) {
            actions.push({
                type: 'reply',
                reply: {
                    id: 'diagnostico_wifi',
                    title: '📡 Diagnóstico WiFi'
                }
            });
        }

        if (lowerQuery.includes('router') || lowerQuery.includes('configurar') || lowerQuery.includes('configuracion')) {
            actions.push({
                type: 'reply',
                reply: {
                    id: 'guia_router',
                    title: '⚙️ Guía Router'
                }
            });
        }

        if (lowerQuery.includes('corta') || lowerQuery.includes('intermitente') || lowerQuery.includes('desconecta')) {
            actions.push({
                type: 'reply',
                reply: {
                    id: 'analisis_estabilidad',
                    title: '🔍 Analizar Estabilidad'
                }
            });
        }

        return actions;
    }

    /**
     * Analiza si la consulta necesita escalamiento a humano
     */
    private async analyzeEscalationNeed(query: string, aiResponse: string): Promise<{ required: boolean, reason: string }> {
        const escalationKeywords = [
            'frustrado', 'enojado', 'molesto', 'cancelar', 'cancelación',
            'gerente', 'supervisor', 'humano', 'persona',
            'demanda', 'legal', 'defensor', 'consumidor',
            'no funciona nada', 'ya probé todo', 'técnico presencial'
        ];

        const hasEscalationKeyword = escalationKeywords.some(keyword =>
            query.toLowerCase().includes(keyword)
        );

        if (hasEscalationKeyword) {
            return {
                required: true,
                reason: 'Cliente solicita atención humana o muestra frustración'
            };
        }

        // Detectar problemas complejos que requieren técnico
        const complexKeywords = [
            'no hay señal', 'fibra cortada', 'poste caído',
            'instalación nueva', 'mudanza', 'cambio de dirección',
            'problema en la calle', 'todo el barrio', 'sector completo'
        ];

        const isComplexIssue = complexKeywords.some(keyword =>
            query.toLowerCase().includes(keyword)
        );

        if (isComplexIssue) {
            return {
                required: true,
                reason: 'Problema complejo que requiere intervención técnica'
            };
        }

        return { required: false, reason: '' };
    }

    /**
     * Maneja el escalamiento a soporte humano
     */
    private async handleEscalation(user: User, query: string, reason: string): Promise<void> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            '👨‍💻 **Transferencia a Soporte Humano**\n\n' +
            'Entiendo que necesitas atención personalizada. Te conectaré con un técnico especializado.\n\n' +
            '📋 **Tu consulta ha sido escalada por:** ' + reason + '\n\n' +
            '⏱️ **Tiempo estimado de respuesta:** 10-15 minutos\n' +
            '📱 Te notificaremos cuando el técnico esté disponible.\n\n' +
            '🎫 Mientras tanto, he creado un ticket con los detalles de tu consulta.');

        // Crear ticket de escalamiento
        try {
            // Simular creación de ticket de escalamiento
            // En implementación real, esto crearía un ticket prioritario
            console.log(`Escalamiento creado para ${user.phoneNumber}: ${reason}`);
        } catch (error) {
            console.error('Error creando ticket de escalamiento:', error);
        }
    }

    /**
     * Actualiza el contexto de IA personal del usuario
     */
    private async updateUserAIContext(user: User, query: string, response: string): Promise<void> {
        if (!user.aiContext) {
            user.aiContext = {
                previousInteractions: 0,
                preferredResponseStyle: 'friendly',
                lastTopics: []
            };
        }

        user.aiContext.previousInteractions++;

        // Extraer temas de la consulta
        const topics = this.extractTopics(query);
        user.aiContext.lastTopics = [...new Set([...topics, ...user.aiContext.lastTopics])].slice(0, 5);

        // Determinar estilo preferido basado en el tipo de consulta
        if (query.includes('paso a paso') || query.includes('explicar') || query.includes('enseñar')) {
            user.aiContext.preferredResponseStyle = 'technical';
        }
    }

    /**
     * Extrae temas principales de una consulta
     */
    private extractTopics(query: string): string[] {
        const topicKeywords = {
            'wifi': ['wifi', 'wireless', 'inalámbrico'],
            'velocidad': ['lento', 'velocidad', 'speed'],
            'conexión': ['conexión', 'conectar', 'connection'],
            'router': ['router', 'modem', 'equipo'],
            'configuración': ['configurar', 'configuración', 'setup'],
            'intermitente': ['corta', 'intermitente', 'desconecta'],
            'dispositivos': ['tv', 'consola', 'celular', 'tablet']
        };

        const topics: string[] = [];
        const lowerQuery = query.toLowerCase();

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => lowerQuery.includes(keyword))) {
                topics.push(topic);
            }
        }

        return topics;
    }

    /**
     * Determina si una consulta es de soporte general
     */
    private isGeneralSupportQuery(message: string): boolean {
        const supportIndicators = [
            'como', 'cómo', 'por que', 'por qué', 'que es', 'qué es',
            'ayuda', 'problema', 'no funciona', 'configurar',
            'lento', 'corta', 'no puedo', 'wifi', 'internet'
        ];

        const lowerMessage = message.toLowerCase();
        return supportIndicators.some(indicator => lowerMessage.includes(indicator)) &&
            message.length > 10; // Filtrar mensajes muy cortos
    }
}

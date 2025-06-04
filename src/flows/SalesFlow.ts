import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, AIService, CustomerService } from '../services';

/**
 * Flujo de ventas con IA avanzada
 */
export class SalesFlow extends BaseConversationFlow {
    readonly name: string = 'sales';

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
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        return (
            // Usuario en flujo de ventas activo
            session.flowActive === 'sales' ||
            // Usuario ha seleccionado ventas y aceptado políticas
            (session.selectedService === 'ventas' && user.acceptedPrivacyPolicy) ||
            // Usuario dice "ventas" directamente
            message.toLowerCase().includes('ventas') ||
            // Usuario solicita información de planes
            message.toLowerCase().includes('plan') && user.acceptedPrivacyPolicy ||
            // Flujo activado automáticamente después de políticas
            session.salesConversationStarted === true
        );
    }    /**
     * Maneja el proceso de ventas con IA
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Si es la primera vez después de aceptar políticas, iniciar automáticamente con IA
            if (session.salesConversationStarted === true && session.flowActive !== 'sales') {
                session.flowActive = 'sales';
                session.salesConversationStarted = false; // Reset flag

                // Inicializar historial de conversación de ventas
                if (!session.salesHistory) {
                    session.salesHistory = [];
                }

                // Mensaje inicial automático de la IA de ventas
                const welcomeMessage = await this.getWelcomeSalesMessage();
                await this.messageService.sendTextMessage(user.phoneNumber, welcomeMessage);

                // Agregar al historial
                session.salesHistory.push({
                    user: "Usuario conectado a ventas",
                    ai: welcomeMessage,
                    timestamp: new Date()
                });

                return true;
            }

            // Si es la primera vez en el flujo de ventas (método anterior)
            if (session.selectedService === 'ventas' && user.acceptedPrivacyPolicy && session.flowActive !== 'sales') {
                session.flowActive = 'sales';

                // Inicializar historial de conversación de ventas
                if (!session.salesHistory) {
                    session.salesHistory = [];
                }

                // Mensaje inicial automático de la IA de ventas
                const welcomeMessage = await this.getWelcomeSalesMessage();
                await this.messageService.sendTextMessage(user.phoneNumber, welcomeMessage);

                // Agregar al historial
                session.salesHistory.push({
                    user: "Usuario conectado a ventas",
                    ai: welcomeMessage,
                    timestamp: new Date()
                });

                return true;
            }

            // Configurar el contexto de ventas para la IA
            const salesContext = this.buildSalesContext(user, session);            // Obtener respuesta de la IA especializada en ventas
            const aiResponse = await this.aiService.getSalesResponse(message, user, session.salesHistory);

            // Enviar la respuesta de la IA
            await this.messageService.sendTextMessage(user.phoneNumber, aiResponse);

            // Actualizar el historial de conversación de ventas
            if (!session.salesHistory) {
                session.salesHistory = [];
            }
            session.salesHistory.push({
                user: message,
                ai: aiResponse,
                timestamp: new Date()
            });

            return true;
        } catch (error) {
            console.error('Error en flujo de ventas:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Te conectaré con un asesor humano en breve.');
            return true;
        }
    }    /**
     * Construye el contexto de ventas para la IA
     */
    private buildSalesContext(user: User, session: SessionData): string {
        let context = `
INFORMACIÓN DE LA EMPRESA:
Eres Andrea, gerente de ventas de Conecta2 Telecomunicaciones en Piendamó, Cauca, Colombia.
Empresa especializada en internet y televisión por fibra óptica.

PLANES DE INTERNET DISPONIBLES:
• 30 Mbps: $40.000/mes
• 50 Mbps: $50.000/mes  
• 60 Mbps: $60.000/mes
• 70 Mbps: $68.000/mes
• 80 Mbps: $75.000/mes
• 100 Mbps: $80.000/mes
* Todos incluyen velocidad de subida de hasta 5 Mbps y soporte técnico

PLANES DE TELEVISIÓN:
• Plan TV HD: 90+ canales analógicos - $40.000/mes
• Más de 85+ canales HD
• App para ver TV en celular
• Series y películas On Demand

PAQUETES COMBINADOS:
• Pack Básico: 30 Mbps + 85+ Canales HD - $60.000/mes (Ahorra $20.000)
• Pack Estándar: 50 Mbps + 85+ Canales HD - $70.000/mes (Ahorra $20.000)  
• Pack Premium: 100 Mbps + 85+ Canales HD - $100.000/mes (Ahorra $20.000)

VENTAJAS COMPETITIVAS:
- Fibra óptica 100% (no cobre)
- Velocidad simétrica real
- Soporte técnico 24/7
- Instalación gratuita
- Sin permanencia mínima
- Cobertura total en Piendamó

TÉCNICAS DE VENTA:
1. Sé muy persuasiva y entusiasta
2. Haz preguntas sobre uso actual de internet
3. Identifica necesidades (trabajo, estudio, streaming, gaming)
4. Recomienda el plan ideal según uso
5. Destaca el ahorro en paquetes combinados
6. Crea urgencia con promociones limitadas
7. Ofrece prueba gratuita de 7 días
8. Facilita el proceso de contratación

PERSONALIDAD: Muy amigable, persuasiva, conocedora, empática y enfocada en cerrar ventas.

ENLACES ÚTILES:
- Web principal: https://conecta2telecomunicaciones.com/
- Planes: https://conecta2telecomunicaciones.com/planes-hogar
        `;

        // Agregar historial de la conversación si existe
        if (session.salesHistory && session.salesHistory.length > 0) {
            context += '\n\nHISTORIAL DE CONVERSACIÓN:\n';
            session.salesHistory.slice(-3).forEach(item => {
                context += `Cliente: ${item.user}\nAndrea: ${item.ai}\n\n`;
            });
        }

        context += '\n\nResponde como Andrea, la gerente de ventas. Sé persuasiva, amigable y enfócate en cerrar la venta.';

        return context;
    }

    /**
     * Genera mensaje de bienvenida personalizado para ventas
     */
    private async getWelcomeSalesMessage(): Promise<string> {
        const welcomeMessages = [
            `¡Hola! 😊 Soy Andrea, tu asesora comercial de Conecta2 Telecomunicaciones.

🎉 ¡Qué alegría tenerte aquí! Estoy súper emocionada de ayudarte a encontrar el plan perfecto para ti.

En Conecta2 somos expertos en fibra óptica 100% - nada de cables viejos de cobre. Tenemos los mejores planes de internet y TV en Piendamó.

💡 Para empezar, cuéntame:
¿Qué uso le das principalmente al internet? 
📱 Redes sociales y WhatsApp
💻 Trabajo o estudio desde casa  
🎮 Gaming y streaming
📺 Netflix, YouTube, series

¡Con esta info te voy a recomendar el plan PERFECTO para ti! 🚀`,

            `¡Hola! 🌟 Soy Andrea de Conecta2 Telecomunicaciones.

¡Perfecto timing! Tenemos promociones increíbles en nuestros planes de fibra óptica.

🔥 ¿Sabías que con nuestros paquetes combinados puedes ahorrar hasta $20.000 al mes?

Por ejemplo:
• Pack Básico: Internet 30MB + TV HD = $60.000 (en lugar de $80.000)
• Pack Premium: Internet 100MB + TV HD = $100.000 (en lugar de $120.000)

Cuéntame, ¿actualmente tienes internet en casa? ¿Qué velocidad tienes y cuánto pagas?

Te aseguro que puedo ofrecerte algo mucho mejor 😉`
        ];

        // Seleccionar mensaje aleatorio
        return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    }
}

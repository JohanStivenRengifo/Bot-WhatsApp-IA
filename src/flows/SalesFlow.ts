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
     */    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const normalizedMessage = message.toLowerCase().trim();

        // Excluir mensajes específicos de upgrade de plan que deben ir a PlanUpgradeFlow
        const planUpgradeKeywords = ['mejorar_plan', 'plan_upgrade', 'upgrade_plan', 'mejora_plan'];
        if (planUpgradeKeywords.some(keyword => normalizedMessage === keyword)) {
            return false;
        }

        return (
            // Usuario en flujo de ventas activo
            session.flowActive === 'sales' ||
            // Usuario ha seleccionado ventas y aceptado políticas
            (session.selectedService === 'ventas' && user.acceptedPrivacyPolicy) ||
            // Usuario dice "ventas" directamente
            message.toLowerCase().includes('ventas') ||
            // Usuario solicita información de planes (pero no upgrade específico)
            (message.toLowerCase().includes('plan') && user.acceptedPrivacyPolicy &&
                !planUpgradeKeywords.some(keyword => normalizedMessage.includes(keyword))) ||
            // Flujo activado automáticamente después de políticas
            session.salesConversationStarted === true
        );
    }/**
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
            }            // Verificar si el cliente solicita propuesta formal
            if (message.toLowerCase().includes('propuesta formal') ||
                message.toLowerCase().includes('propuesta') ||
                message.toLowerCase().includes('cotización') ||
                message.toLowerCase().includes('cotizacion')) {

                // Generar y enviar PDF
                await this.generateAndSendQuotation(user, session, message);
                return true;
            }

            // Configurar el contexto de ventas para la IA
            const salesContext = this.buildSalesContext(user, session);// Obtener respuesta de la IA especializada en ventas
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
        // Verificar si ya se cerró una venta
        const ventaCerrada = session.salesHistory?.some(item =>
            item.user.toLowerCase().includes('propuesta formal') ||
            item.user.toLowerCase().includes('contratar') ||
            item.ai.toLowerCase().includes('te envío la propuesta') ||
            item.ai.toLowerCase().includes('recibirás un correo')
        );

        let context = `
INFORMACIÓN DE LA EMPRESA:
Eres Andrea, asesora comercial amigable de Conecta2 Telecomunicaciones en Piendamó, Cauca, Colombia.
Empresa especializada en internet y televisión por fibra óptica.

PLANES EXACTOS DISPONIBLES:

INTERNET SOLO:
• 30 Mbps: $40.000/mes
• 50 Mbps: $50.000/mes  
• 60 Mbps: $60.000/mes
• 70 Mbps: $68.000/mes
• 80 Mbps: $75.000/mes
• 100 Mbps: $80.000/mes
* Todos incluyen velocidad de subida hasta 5 Mbps y soporte técnico

TELEVISIÓN SOLA:
• Plan TV HD: $40.000/mes (90+ canales analógicos, 85+ canales HD, App móvil, On Demand)

PAQUETES COMBINADOS (MUY POPULARES):
• Pack Básico: Internet 30 Mbps + TV HD (85+ Canales) = $60.000/mes (Ahorro: $20.000)
• Pack Estándar: Internet 50 Mbps + TV HD (85+ Canales) = $70.000/mes (Ahorro: $20.000)  
• Pack Premium: Internet 100 Mbps + TV HD (85+ Canales) = $100.000/mes (Ahorro: $20.000)

VENTAJAS:
- Fibra óptica 100% - Soporte 24/7 - Sin permanencia

INSTRUCCIONES IMPORTANTES:
${ventaCerrada ? `
⚠️ EL CLIENTE YA SOLICITÓ UNA PROPUESTA FORMAL O CONTRATÓ UN SERVICIO.
- NO sigas vendiendo
- NO insistas con más ofertas
- Confirma que recibirá la información solicitada
- Agradece su interés y finaliza amablemente
- Si pregunta algo más, responde brevemente y cierra la conversación
` : `
PROCESO DE VENTA:
1. Saluda amigablemente y pregunta qué necesita
2. Identifica su uso actual de internet/TV
3. Recomienda el plan que mejor se adapte
4. Si muestra interés, ofrece generar propuesta formal
5. Cuando solicite propuesta formal, genera el PDF y finaliza
6. Si dice "no" o "finalizar", agradece y termina cordialmente

PERSONALIDAD: Amigable, natural, no insistente. Si el cliente no está interesado, respeta su decisión.
`}

ENLACES:
- Web: https://conecta2telecomunicaciones.com/
- Planes: https://conecta2telecomunicaciones.com/planes-hogar
        `;

        // Agregar historial reciente
        if (session.salesHistory && session.salesHistory.length > 0) {
            context += '\n\nHISTORIAL RECIENTE:\n';
            session.salesHistory.slice(-2).forEach(item => {
                context += `Cliente: ${item.user}\nAndrea: ${item.ai}\n\n`;
            });
        }

        return context;
    }    /**
     * Genera mensaje de bienvenida personalizado para ventas
     */
    private async getWelcomeSalesMessage(): Promise<string> {
        const welcomeMessages = [
            `¡Hola! 😊 Soy Andrea, tu asesora comercial de Conecta2 Telecomunicaciones.

¡Me alegra mucho poder ayudarte! 

Somos especialistas en fibra óptica aquí en Piendamó y tenemos planes súper buenos tanto de internet como de TV.

Para poder recomendarte lo que mejor te convenga, cuéntame:
¿Actualmente tienes internet en casa? ¿Qué tal te funciona?

¡Así puedo darte la mejor opción! 🌟`,

            `¡Hola! 😊 Soy Andrea de Conecta2 Telecomunicaciones.

¡Qué bueno que estés interesado en nuestros servicios!

Tenemos planes increíbles de internet fibra óptica y TV que realmente funcionan bien. 

¿Me puedes contar qué tipo de servicio te interesa más?
📡 Internet
📺 TV  
📦 Los dos juntos (tenemos ofertas geniales)

¡Te voy a dar las mejores opciones! ✨`
        ];

        return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    }

    /**
     * Genera y envía cotización en PDF al cliente
     */
    private async generateAndSendQuotation(user: User, session: SessionData, message: string): Promise<void> {
        try {
            // Extraer información del plan solicitado del historial
            const planInfo = this.extractPlanFromHistory(session.salesHistory || []);

            await this.messageService.sendTextMessage(user.phoneNumber,
                `📋 ¡Perfecto! Te estoy preparando la cotización formal.
                
Plan seleccionado: ${planInfo.name}
Precio: ${planInfo.price}
                
📧 Te enviaré la propuesta formal por correo electrónico en los próximos minutos con todos los detalles, términos y condiciones.

🎉 ¡Gracias por confiar en Conecta2 Telecomunicaciones!

Si tienes alguna pregunta sobre la propuesta, no dudes en contactarnos.`);

            // Marcar que se envió la cotización
            session.salesHistory = session.salesHistory || [];
            session.salesHistory.push({
                user: message,
                ai: "Cotización formal enviada - Venta procesada",
                timestamp: new Date()
            });

            // Simular envío de email (aquí se integraría con el servicio de email real)
            console.log(`Cotización generada para ${user.phoneNumber} - Plan: ${planInfo.name}`);

        } catch (error) {
            console.error('Error generando cotización:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Hubo un problema generando la cotización. Un asesor se contactará contigo pronto.');
        }
    }

    /**
     * Extrae información del plan del historial de conversación
     */
    private extractPlanFromHistory(history: Array<{ user: string, ai: string }>): { name: string, price: string } {
        // Buscar menciones de planes en el historial
        const defaultPlan = { name: "Plan Premium (100 Mbps + TV HD)", price: "$100.000/mes" };

        for (const item of history.reverse()) {
            const text = (item.user + " " + item.ai).toLowerCase();

            if (text.includes('premium')) {
                return { name: "Pack Premium (100 Mbps + TV HD)", price: "$100.000/mes" };
            }
            if (text.includes('estándar') || text.includes('estandar')) {
                return { name: "Pack Estándar (50 Mbps + TV HD)", price: "$70.000/mes" };
            }
            if (text.includes('básico') || text.includes('basico')) {
                return { name: "Pack Básico (30 Mbps + TV HD)", price: "$60.000/mes" };
            }
            if (text.includes('100 mbps')) {
                return { name: "Internet 100 Mbps", price: "$80.000/mes" };
            }
            if (text.includes('tv') && !text.includes('pack')) {
                return { name: "Plan TV HD", price: "$40.000/mes" };
            }
        }

        return defaultPlan;
    }
}

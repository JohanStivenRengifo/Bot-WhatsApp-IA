import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, AIService, CustomerService, TicketService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';
import axios from 'axios';
import { config } from '../config';

/**
 * Flujo de ventas con IA avanzada
 */
export class SalesFlow extends BaseConversationFlow {
    readonly name: string = 'sales';

    private aiService: AIService;
    private customerService: CustomerService;
    private ticketService: TicketService;
    private apiKey: string;
    private apiUrl: string;

    // Planes de internet disponibles - configuración estática para autonomía 
    private readonly internetPlans = [
        { id: 'plan_30', name: '30 Mbps', speed: '50/20 Mbps', price: 40000, description: 'Ideal para uso básico y navegación' },
        { id: 'plan_50', name: '50 Mbps', speed: '100/50 Mbps', price: 50000, description: 'Perfecto para familias y trabajo remoto' },
        { id: 'plan_60', name: '60 Mbps', speed: '200/100 Mbps', price: 60000, description: 'Excelente para gaming y streaming' },
        { id: 'plan_70', name: '70 Mbps', speed: '300/150 Mbps', price: 68000, description: 'Velocidad premium para empresas' },
        { id: 'plan_80', name: '80 Mbps', speed: '500/250 Mbps', price: 75000, description: 'Ultra velocidad para uso intensivo' },
        { id: 'plan_100', name: '100 Mbps', speed: '1000/500 Mbps', price: 80000, description: 'Máxima velocidad para hogares' }
    ];

    // Planes de TV disponibles - configuración estática para autonomía 
    private readonly tvPlans = [
        { id: 'tv_hd', name: 'TV Completo', channels: '80+ canales HD', price: 40000, description: '+85 Canales en HD' }
    ];

    // Combos disponibles con descuentos especiales 
    private readonly comboPlan = [
        { id: 'combo_basico', name: 'Combo Básico', description: '30 Mbps + TV HD', originalPrice: 80000, comboPrice: 60000 },
        { id: 'combo_standar', name: 'Combo Familiar', description: '50 Mbps + TV HD', originalPrice: 115000, comboPrice: 70000 },
        { id: 'combo_premium', name: 'Combo Premium', description: '100 Mbps + TV HD', originalPrice: 155000, comboPrice: 100000 }
    ];

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        aiService: AIService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.aiService = aiService;
        this.customerService = customerService;
        this.ticketService = new TicketService();

        // Configurar API key y URL para tickets
        this.apiKey = config.wisphub.apiKey || 'Api-Key mHHsEQKX.Uc1BQzXFOCXUno64ZTM9K4vaDPjH9gLq';
        this.apiUrl = config.wisphub.baseUrl + '/api/tickets/' || 'https://api.wisphub.app/api/tickets/';
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        // Si estamos en proceso de contratación, este flujo debe manejar el mensaje
        if (session.contractingPlan === true) {
            return true;
        }

        // Excluir mensajes específicos de upgrade de plan que deben ir a PlanUpgradeFlow
        const planUpgradeKeywords = ['mejorar_plan', 'plan_upgrade', 'upgrade_plan', 'mejora_plan'];
        if (planUpgradeKeywords.includes(extractedCommand)) {
            return false;
        }

        // Detectar intención de contratar mediante palabras clave
        const hasContractingIntent = isMenuCommand(message, [
            'contratar', 'quiero el plan', 'me interesa', 'adquirir', 'comprar'
        ]);

        return (
            // Usuario en flujo de ventas activo
            session.flowActive === 'sales' ||
            // Usuario ha seleccionado ventas y aceptado políticas
            (session.selectedService === 'ventas' && user.acceptedPrivacyPolicy) ||
            // Usuario dice "ventas" directamente
            extractedCommand === 'ventas' ||
            // Usuario solicita información de planes (pero no upgrade específico)
            (isMenuCommand(message, ['plan', 'planes', 'internet']) && user.acceptedPrivacyPolicy &&
                !planUpgradeKeywords.includes(extractedCommand)) ||
            // Flujo activado automáticamente después de políticas
            session.salesConversationStarted === true ||
            // Usuario quiere contratar un plan
            hasContractingIntent
        );
    }/**
     * Maneja el mensaje del usuario
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Inicializar historial de ventas si no existe
            if (!session.salesHistory) {
                session.salesHistory = [];
            }

            // Marcar que estamos en el flujo de ventas
            session.flowActive = 'sales';
            session.salesConversationStarted = true;

            // Si estamos en proceso de contratación, manejar ese flujo
            if (session.contractingPlan === true) {
                return await this.handleContractingProcess(user, message, session);
            }

            // Mensaje de bienvenida si es la primera interacción
            if (session.salesHistory.length === 0) {
                await this.getWelcomeSalesMessage(user, session);
            }

            // Detectar si el usuario quiere contratar un plan
            if (message.toLowerCase().includes('contratar') ||
                message.toLowerCase().includes('quiero el plan') ||
                message.toLowerCase().includes('me interesa') ||
                message.toLowerCase().includes('adquirir') ||
                message.toLowerCase().includes('comprar')) {

                return await this.startContractingProcess(user, message, session);
            }

            // Detectar si el usuario solicita una propuesta formal
            if (message.toLowerCase().includes('propuesta formal') ||
                message.toLowerCase().includes('cotización formal') ||
                message.toLowerCase().includes('envíame la propuesta') ||
                message.toLowerCase().includes('enviar propuesta')) {

                return await this.generateAndSendQuotation(user, message, session);
            }            // Construir contexto para la IA
            const context = this.buildSalesContext(user, session);

            // Obtener respuesta de la IA
            const aiResponse = await this.aiService.getSalesResponse(message, user, session.salesHistory);

            // Enviar respuesta al usuario
            await this.messageService.sendTextMessage(user.phoneNumber, aiResponse);

            // Guardar en historial
            session.salesHistory.push({
                user: message,
                ai: aiResponse,
                timestamp: new Date()
            });

            return true;
        } catch (error) {
            console.error('Error en SalesFlow:', error);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                'Lo siento, ha ocurrido un error al procesar tu solicitud. Por favor, intenta nuevamente más tarde.'
            );
            return false;
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
• 30 Mbps: $40.000/mes (10/5 Mbps)
• 50 Mbps: $50.000/mes (10/5 Mbps)
• 60 Mbps: $60.000/mes (10/5 Mbps)
• 70 Mbps: $68.000/mes (10/5 Mbps)
• 80 Mbps: $75.000/mes (10/5 Mbps)
• 100 Mbps: $80.000/mes (10/5 Mbps)

TELEVISIÓN SOLA:
• TV Completo: $40.000/mes (80+ canales HD)

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
4. Si muestra interés, ofrece contratar el servicio
5. Si dice "contratar" o "me interesa", pide datos de contacto
6. Si dice "no" o "finalizar", agradece y termina cordialmente

PERSONALIDAD: Amigable, directo, no insistente. Respuestas cortas, sencillas y claras.
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
    }

    /**
     * Inicia el proceso de contratación
     */
    private async startContractingProcess(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Extraer información del plan mencionado
            const planInfo = this.extractPlanFromHistory(session.salesHistory || []);

            // Inicializar el proceso de contratación
            session.contractingPlan = true;
            session.contractingStep = 'name';
            session.contractData = {
                planName: planInfo.name,
                planPrice: planInfo.price,
                startTime: new Date()
            };

            // Enviar mensaje solicitando datos de contacto
            await this.messageService.sendTextMessage(user.phoneNumber,
                `¡Excelente elección! 🎉 Has seleccionado el plan ${planInfo.name} por ${planInfo.price}.

Para continuar con tu contratación, necesito algunos datos:

👤 Por favor, escribe tu nombre completo:`
            );

            // Registrar en historial
            if (!session.salesHistory) {
                session.salesHistory = [];
            }

            session.salesHistory.push({
                user: message,
                ai: `Iniciando proceso de contratación para plan ${planInfo.name}`,
                timestamp: new Date()
            });

            return true;
        } catch (error) {
            console.error('Error iniciando contratación:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Te conectaré con un asesor humano en breve.');
            return true;
        }
    }

    /**
     * Maneja el proceso de contratación paso a paso
     */
    private async handleContractingProcess(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            if (!session.contractData) {
                session.contractData = {
                    planName: "Plan no especificado",
                    planPrice: "Precio no especificado",
                    startTime: new Date()
                };
            }

            switch (session.contractingStep) {
                case 'name':
                    session.contractData.name = message;
                    session.contractingStep = 'email';
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        `Gracias ${message.split(' ')[0]}. Ahora necesito tu correo electrónico para enviarte la confirmación:`
                    );
                    break;

                case 'email':
                    session.contractData.email = message;
                    session.contractingStep = 'address';
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        "Perfecto. ¿Cuál es tu dirección donde se instalará el servicio?"
                    );
                    break;

                case 'address':
                    session.contractData.address = message;
                    session.contractingStep = 'phone';
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        "Excelente. ¿Tienes algún teléfono fijo o celular adicional de contacto? (Si no tienes otro, escribe 'No')"
                    );
                    break;

                case 'phone':
                    session.contractData.alternativePhone = message;
                    session.contractingStep = 'confirm';

                    // Mostrar resumen y pedir confirmación
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        `📋 **Resumen de tu contratación:**

` +
                        `• Plan: ${session.contractData.planName}
` +
                        `• Precio: ${session.contractData.planPrice}
` +
                        `• Nombre: ${session.contractData.name}
` +
                        `• Email: ${session.contractData.email}
` +
                        `• Dirección: ${session.contractData.address}
` +
                        `• Teléfono adicional: ${session.contractData.alternativePhone}

` +
                        `¿Confirmas estos datos? (Responde 'Sí' para confirmar o 'No' para cancelar)`
                    );
                    break;

                case 'confirm':
                    if (message.toLowerCase().includes('s') || message.toLowerCase().includes('si')) {
                        // Crear ticket de alta prioridad
                        await this.createSalesTicket(user, session);

                        // Finalizar proceso
                        session.contractingPlan = false;
                        session.contractingStep = undefined;

                        // Enviar mensaje de confirmación
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            `✅ **¡Contratación Exitosa!**

` +
                            `Hemos registrado tu solicitud para el plan ${session.contractData.planName}.

` +
                            `🔍 Un asesor se pondrá en contacto contigo en las próximas 24 horas para coordinar la instalación.

` +
                            `📅 Fecha estimada de instalación: 1-3 días hábiles.

` +
                            `¡Gracias por confiar en Conecta2 Telecomunicaciones! 🎉`
                        );
                    } else {
                        // Cancelar proceso
                        session.contractingPlan = false;
                        session.contractingStep = undefined;

                        await this.messageService.sendTextMessage(user.phoneNumber,
                            "Has cancelado el proceso de contratación. Si deseas retomarlo o tienes alguna duda, estoy aquí para ayudarte."
                        );
                    }
                    break;

                default:
                    // Reiniciar proceso si hay algún error
                    return await this.startContractingProcess(user, message, session);
            }

            return true;
        } catch (error) {
            console.error('Error en proceso de contratación:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Te conectaré con un asesor humano en breve.');

            // Limpiar estado de contratación
            session.contractingPlan = false;
            session.contractingStep = undefined;

            return true;
        }
    }

    /**
     * Crea un ticket de ventas de alta prioridad
     */
    private async createSalesTicket(user: User, session: SessionData): Promise<void> {
        try {
            if (!session.contractData) {
                throw new Error('No hay datos de contratación');
            }

            const now = new Date();
            const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            // Obtener ID de servicio del usuario o usar uno predeterminado
            const userData = this.decodeUserData(user);
            const serviceId = userData?.serviceId || "37";

            // Preparar descripción del ticket
            const description = `<p><strong>NUEVA CONTRATACIÓN DE SERVICIO</strong></p>
` +
                `<p><strong>Plan:</strong> ${session.contractData.planName}</p>
` +
                `<p><strong>Nombre:</strong> ${session.contractData.name}</p>
` +
                `<p><strong>Email:</strong> ${session.contractData.email}</p>
` +
                `<p><strong>Dirección:</strong> ${session.contractData.address}</p>
` +
                `<p><strong>Teléfono WhatsApp:</strong> ${user.phoneNumber}</p>
` +
                `<p><strong>Teléfono adicional:</strong> ${session.contractData.alternativePhone}</p>
` +
                `<p><strong>Fecha de solicitud:</strong> ${formattedDate}</p>`;

            // Intentar crear ticket usando WispHub API
            try {
                const ticketData = new FormData();
                ticketData.append('asuntos_default', "Nueva Contratación");
                ticketData.append('asunto', "Nueva Contratación - Plan " + session.contractData.planName);

                // Campo de técnico - REQUERIDO por WispHub API
                let technicianId = config.wisphub.defaultTechnicianId?.trim();
                if (!technicianId || technicianId === '') {
                    technicianId = '417534'; // Usuario administrativo de Conecta2tel
                }
                ticketData.append('tecnico', technicianId);

                ticketData.append('descripcion', description);
                ticketData.append('estado', "1"); // 1=Nuevo
                ticketData.append('prioridad', "3"); // 3=Alta
                ticketData.append('servicio', serviceId);
                ticketData.append('fecha_inicio', formattedDate);
                ticketData.append('fecha_final', formattedDate);
                ticketData.append('origen_reporte', "whatsapp");
                ticketData.append('departamento', "Ventas");
                ticketData.append('departamentos_default', "Ventas");

                // Realizar la petición a la API de WispHub
                await axios.post(this.apiUrl, ticketData, {
                    headers: {
                        'Authorization': this.apiKey
                    }
                });

                console.log('✅ Ticket de ventas creado exitosamente en WispHub');

            } catch (error) {
                console.error('Error al crear ticket en WispHub:', error);

                // Intento alternativo usando el servicio interno
                const ticketData = {
                    customerId: user.customerId || "nuevo_cliente",
                    category: "ventas",
                    description: description.replace(/<\/?[^>]+(>|$)/g, ""), // Eliminar HTML tags
                    priority: 'alta' as const,
                    source: 'whatsapp',
                    clientInfo: {
                        name: session.contractData.name,
                        phone: user.phoneNumber,
                        address: session.contractData.address
                    }
                };

                await this.ticketService.createTicket(ticketData);
                console.log('✅ Ticket de ventas creado exitosamente con sistema de respaldo');
            }

            // Registrar en historial
            if (!session.salesHistory) {
                session.salesHistory = [];
            }

            session.salesHistory.push({
                user: "Confirmación de contratación",
                ai: `Ticket de ventas creado para plan ${session.contractData.planName}`,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error creando ticket de ventas:', error);
            throw error; // Propagar error para manejo en nivel superior
        }
    }

    /**
     * Decodifica los datos del usuario desde la información almacenada
     */
    protected decodeUserData(user: User): any {
        if (!user.customerId) {
            return null;
        }

        try {
            // Intentar usar los datos de servicios del usuario primero
            if (user.userServices && user.userServices.length > 0) {
                const service = user.userServices[0];
                return {
                    serviceId: service.id,
                    customerName: service.name,
                    status: service.status
                };
            }

            // Intentar usar el método de la clase base si hay datos encriptados
            if (user.encryptedData) {
                const baseData = super.decodeUserData(user);
                if (baseData) {
                    return baseData;
                }
            }

            // Fallback
            return {
                serviceId: user.customerId,
                customerName: "Usuario",
                status: "unknown"
            };
        } catch (error) {
            console.error('Error decodificando datos de usuario:', error);
            return {
                serviceId: user.customerId,
                customerName: "Usuario",
                status: "unknown"
            };
        }
    }    /**
     * Genera mensaje de bienvenida personalizado para ventas
     */
    private async getWelcomeSalesMessage(user: User, session: SessionData): Promise<string> {
        // Mensaje de bienvenida más directo y conciso
        const welcomeMessage = `¡Hola! 👋 Soy Andrea de Conecta2 Telecomunicaciones.

Tenemos los mejores planes de fibra óptica:

🚀 Internet: desde $40.000/mes (50/20 Mbps)
📺 TV HD: $40.000/mes (80+ canales)
🔥 Combos: desde $60.000/mes

¿Qué tipo de plan buscas? ¿Para gaming, trabajo, familia?`;

        await this.messageService.sendTextMessage(user.phoneNumber, welcomeMessage);

        // Guardar en historial
        if (!session.salesHistory) {
            session.salesHistory = [];
        }

        session.salesHistory.push({
            user: "Usuario conectado a ventas",
            ai: welcomeMessage,
            timestamp: new Date()
        });

        return welcomeMessage;
    }

    /**
     * Genera y envía una cotización formal
     */
    private async generateAndSendQuotation(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Extraer información del plan mencionado
            const planInfo = this.extractPlanFromHistory(session.salesHistory || []);

            // Enviar mensaje de confirmación más conciso
            await this.messageService.sendTextMessage(user.phoneNumber,
                `✅ ¡Listo! Te enviaré la propuesta formal para ${planInfo.name} (${planInfo.price}).

Recibirás un correo con los detalles en breve y un asesor te contactará pronto.

¿Deseas contratar este plan ahora? Responde "Sí quiero contratar" y te guiaré en el proceso.`
            );

            // Registrar en historial
            if (!session.salesHistory) {
                session.salesHistory = [];
            }

            session.salesHistory.push({
                user: message,
                ai: `Propuesta formal enviada para plan ${planInfo.name}`,
                timestamp: new Date()
            });

            return true;
        } catch (error) {
            console.error('Error generando cotización:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, no pude generar la propuesta. ¿Podrías intentarlo nuevamente?');
            return false;
        }
    }

    /**
     * Extrae información del plan mencionado en el historial
     */
    private extractPlanFromHistory(history: Array<{ user: string, ai: string, timestamp?: Date }>): any {
        // Buscar menciones de planes en el historial
        const allText = history.map(item => `${item.user} ${item.ai}`).join(' ').toLowerCase();

        // Planes de internet
        for (const plan of this.internetPlans) {
            if (allText.includes(plan.name.toLowerCase()) ||
                allText.includes(plan.speed.toLowerCase())) {
                return {
                    name: `Internet ${plan.name}`,
                    price: `$${plan.price.toLocaleString('es-CO')}/mes`,
                    id: plan.id,
                    speed: plan.speed
                };
            }
        }

        // Combos
        for (const combo of this.comboPlan) {
            if (allText.includes(combo.name.toLowerCase()) ||
                allText.includes(combo.description.toLowerCase())) {
                return {
                    name: combo.name,
                    price: `$${combo.comboPrice.toLocaleString('es-CO')}/mes`,
                    id: combo.id,
                    description: combo.description
                };
            }
        }

        // TV
        for (const tv of this.tvPlans) {
            if (allText.includes(tv.name.toLowerCase()) ||
                allText.includes('tv hd') ||
                allText.includes('televisión')) {
                return {
                    name: tv.name,
                    price: `$${tv.price.toLocaleString('es-CO')}/mes`,
                    id: tv.id,
                    channels: tv.channels
                };
            }
        }

        // Default - Plan más básico de internet
        const defaultPlan = this.internetPlans[0];
        return {
            name: `Internet ${defaultPlan.name}`,
            price: `$${defaultPlan.price.toLocaleString('es-CO')}/mes`,
            id: defaultPlan.id,
            speed: defaultPlan.speed
        };
    }
}

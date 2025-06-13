import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService, TicketService, AzureOpenAIService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';
import axios from 'axios';
import { config } from '../config';

/**
 * Flujo de ventas con IA de Azure OpenAI
 */
export class SalesFlow extends BaseConversationFlow {
    readonly name: string = 'sales';

    private azureOpenAIService: AzureOpenAIService;
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
    ];    // Planes de TV disponibles - configuración estática para autonomía
    private readonly tvPlans = [
        { id: 'tv_hd', name: 'TV Completo', channels: '85+ canales HD', price: 40000, description: '+85 Canales en HD' }
    ];    // Combos disponibles con descuentos especiales
    private readonly comboPlan = [
        { id: 'combo_basico', name: 'Combo Básico', description: '30 Mbps + TV HD', originalPrice: 80000, comboPrice: 60000, discount: 20000 },
        { id: 'combo_standar', name: 'Combo Familiar', description: '50 Mbps + TV HD', originalPrice: 90000, comboPrice: 70000, discount: 20000 },
        { id: 'combo_premium', name: 'Combo Premium', description: '100 Mbps + TV HD', originalPrice: 120000, comboPrice: 100000, discount: 20000 }
    ]; constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.azureOpenAIService = new AzureOpenAIService();
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

        // Si el flujo de ventas no está activo, verificar intenciones específicas
        if (session.flowActive !== 'sales' && !session.salesConversationStarted) {
            // Solo activar si hay intención explícita de ventas
            const salesKeywords = ['ventas', 'contratar', 'plan', 'planes', 'internet', 'tv', 'combo'];
            const hasSalesIntent = salesKeywords.some(keyword =>
                message.toLowerCase().includes(keyword) || extractedCommand === keyword
            );

            // También verificar si ha seleccionado ventas desde el menú
            const selectedVentas = session.selectedService === 'ventas' && user.acceptedPrivacyPolicy;

            return hasSalesIntent || selectedVentas;
        }

        // Si ya está en el flujo de ventas, continuar manejando
        return session.flowActive === 'sales' || session.salesConversationStarted === true;
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
            }            // Mensaje de bienvenida si es la primera interacción (usando IA)
            if (session.salesHistory.length === 0) {
                await this.getWelcomeSalesMessage(user, session);
            }

            // Detectar si el usuario quiere contratar un plan (usando IA también)
            if (message.toLowerCase().includes('contratar') ||
                message.toLowerCase().includes('quiero el plan') ||
                message.toLowerCase().includes('me interesa') ||
                message.toLowerCase().includes('adquirir') ||
                message.toLowerCase().includes('comprar')) {

                return await this.startContractingProcess(user, message, session);
            }

            // Usar solo Azure OpenAI para todas las respuestas (eliminar respuestas estáticas)
            const context = this.buildSalesContext(user, session);
            const plansData = this.getPlansData();

            try {
                // Obtener respuesta de Azure OpenAI con planes específicos
                const response = await this.azureOpenAIService.getSalesResponse(message, plansData, context);

                if (response.success) {
                    // Enviar respuesta al usuario
                    await this.messageService.sendTextMessage(user.phoneNumber, response.message);

                    // Guardar en historial
                    session.salesHistory.push({
                        user: message,
                        ai: response.message,
                        timestamp: new Date()
                    });

                    // Verificar si el cliente quiere proceder con instalación/cotización
                    await this.checkForTicketCreation(user, message, response.message, session);
                } else {
                    throw new Error(response.error || 'Error en respuesta de IA');
                }
            } catch (error) {
                // Si falla la IA, mostrar error y ofrecer contacto humano
                console.error('Error obteniendo respuesta de Azure OpenAI:', error);
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    'Disculpa, tengo problemas técnicos en este momento. ¿Te gustaría que un asesor humano te contacte? Escribe "agente" para transferir tu consulta.'
                );
            }

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

        let context = `INFORMACIÓN DEL CLIENTE:
- Teléfono: ${user.phoneNumber}
- Estado de contratación: ${session.contractingPlan ? 'EN PROCESO' : 'CONSULTANDO'}
- Historial de conversación: ${session.salesHistory?.length || 0} interacciones
${ventaCerrada ? '⚠️ IMPORTANTE: Cliente ya solicitó contratación/propuesta anteriormente' : ''}

INSTRUCCIONES ESPECÍFICAS:
- Primera interacción: Presenta los servicios de manera atractiva y pregunta por sus necesidades
- Cliente consultando: Enfócate en resolver dudas y recomendar el plan ideal según su uso
- Cliente interesado en contratar: Guíalo hacia el proceso de contratación
- Cliente con dudas técnicas: Explica beneficios de fibra óptica vs otros servicios
- Cliente pidiendo precios: Muestra planes con precios exactos y destaca ahorros en combos`;

        // Agregar solo las últimas 3 interacciones para mantener contexto relevante
        if (session.salesHistory && session.salesHistory.length > 0) {
            context += '\n\nÚLTIMAS INTERACCIONES:\n';
            session.salesHistory.slice(-3).forEach((item, index) => {
                const userMsg = item.user.length > 150 ? item.user.substring(0, 150) + '...' : item.user;
                const aiMsg = item.ai.length > 150 ? item.ai.substring(0, 150) + '...' : item.ai;
                context += `${index + 1}. Cliente: "${userMsg}"\n   Andrea: "${aiMsg}"\n\n`;
            });
        }

        return context;
    }    /**
     * Inicia el proceso de contratación usando IA para personalizar los mensajes
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

            // Usar IA para generar mensaje de inicio de contratación personalizado
            const contractPrompt = `El cliente quiere contratar el ${planInfo.name} por ${planInfo.price}. Genera un mensaje entusiasta de confirmación y solicita su nombre completo para iniciar el proceso de contratación.`;

            try {
                const response = await this.azureOpenAIService.sendMessage(contractPrompt);

                if (response.success) {
                    await this.messageService.sendTextMessage(user.phoneNumber, response.message);
                } else {
                    throw new Error('Error en respuesta de IA');
                }
            } catch (error) {
                console.error('Error generando mensaje de contratación, usando fallback');
                await this.messageService.sendTextMessage(user.phoneNumber,
                    `¡Excelente elección! 🎉 Has seleccionado el plan ${planInfo.name} por ${planInfo.price}.\n\nPara continuar con tu contratación, necesito algunos datos:\n\n👤 Por favor, escribe tu nombre completo:`
                );
            }

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
                    break; case 'confirm':
                    if (message.toLowerCase().includes('s') || message.toLowerCase().includes('si')) {
                        // Guardar datos necesarios antes de crear el ticket
                        const planName = session.contractData.planName;

                        // Crear ticket de alta prioridad
                        await this.createSalesTicket(user, session);

                        // Enviar mensaje de confirmación usando los datos guardados
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            `✅ **¡Contratación Exitosa!**

` +
                            `Hemos registrado tu solicitud para el plan ${planName}.

` +
                            `🔍 Un asesor se pondrá en contacto contigo en las próximas 24 horas para coordinar la instalación.

` +
                            `📅 Fecha estimada de instalación: 1-3 días hábiles.

` +
                            `¡Gracias por confiar en Conecta2 Telecomunicaciones! 🎉`
                        );                        // Limpiar completamente el flujo de ventas después de todo
                        session.flowActive = undefined;
                        session.salesConversationStarted = false;
                        session.selectedService = undefined;
                        session.contractingPlan = false;
                        session.contractingStep = undefined;
                        session.contractData = undefined;
                        // Limpiar también el historial de ventas para empezar de cero
                        session.salesHistory = [];

                        console.log('✅ Flujo de ventas cerrado completamente después de crear el ticket');
                    } else {
                        // Cancelar proceso y limpiar completamente la sesión
                        session.contractingPlan = false;
                        session.contractingStep = undefined;
                        session.contractData = undefined;
                        session.flowActive = undefined;
                        session.salesConversationStarted = false;
                        session.selectedService = undefined;
                        session.salesHistory = [];

                        await this.messageService.sendTextMessage(user.phoneNumber,
                            "Has cancelado el proceso de contratación. Si deseas retomarlo o tienes alguna duda, escribe 'ventas' para comenzar de nuevo."
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
                '❌ Lo siento, ha ocurrido un error. Te conectaré con un asesor humano en breve.');            // Limpiar estado de contratación si hay error
            session.contractingPlan = false;
            session.contractingStep = undefined;
            session.contractData = undefined;
            session.flowActive = undefined;
            session.salesConversationStarted = false;
            session.selectedService = undefined;

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
                `<p><strong>Fecha de solicitud:</strong> ${formattedDate}</p>`;            // Intentar crear ticket usando WispHub API
            try {
                const ticketData = new FormData();
                ticketData.append('asuntos_default', "Otro Asunto");
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
                // Para ventas, usar un ID de servicio numérico válido en lugar de "nuevo_cliente"
                const fallbackServiceId = user.customerId || "37"; // Usar ID numérico por defecto

                const ticketData = {
                    customerId: fallbackServiceId,
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
            }            // Registrar en historial
            if (!session.salesHistory) {
                session.salesHistory = [];
            }

            session.salesHistory.push({
                user: "Confirmación de contratación",
                ai: `Ticket de ventas creado para plan ${session.contractData.planName}`,
                timestamp: new Date()
            });

            console.log('✅ Ticket de ventas creado exitosamente');

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
     * Genera mensaje de bienvenida personalizado con IA
     */
    private async getWelcomeSalesMessage(user: User, session: SessionData): Promise<string> {
        const context = this.buildSalesContext(user, session);
        const plansData = this.getPlansData();

        // Usar IA para generar mensaje de bienvenida personalizado
        const welcomePrompt = "El usuario acaba de conectarse al área de ventas. Genera un mensaje de bienvenida amigable y profesional que presente nuestros servicios de manera atractiva.";

        try {
            const response = await this.azureOpenAIService.getSalesResponse(welcomePrompt, plansData, context);

            if (response.success) {
                await this.messageService.sendTextMessage(user.phoneNumber, response.message);

                // Guardar en historial
                if (!session.salesHistory) {
                    session.salesHistory = [];
                }

                session.salesHistory.push({
                    user: "Usuario conectado a ventas",
                    ai: response.message,
                    timestamp: new Date()
                });

                return response.message;
            } else {
                throw new Error(response.error || 'Error generando mensaje de bienvenida');
            }
        } catch (error) {
            console.error('Error generando mensaje de bienvenida con IA:', error);
            // Fallback muy básico si falla la IA
            const fallbackMessage = `¡Hola! Soy Andrea de Conecta2 Telecomunicaciones. ¿En qué puedo ayudarte hoy?`;
            await this.messageService.sendTextMessage(user.phoneNumber, fallbackMessage);
            return fallbackMessage;
        }
    }/**
     * Extrae información del plan mencionado en el historial
     */
    private extractPlanFromHistory(history: Array<{ user: string, ai: string, timestamp?: Date }>): any {
        // Si no hay historial, devolver el plan básico por defecto
        if (!history || history.length === 0) {
            const defaultPlan = this.internetPlans[0];
            return {
                name: `Internet ${defaultPlan.name}`,
                price: `$${defaultPlan.price.toLocaleString('es-CO')}/mes`,
                id: defaultPlan.id,
                speed: defaultPlan.speed
            };
        }

        // Primero buscar en la última interacción del usuario (más relevante)
        const lastInteraction = history[history.length - 1];
        const lastMessageText = (lastInteraction.user + ' ' + lastInteraction.ai).toLowerCase();

        // Intentar encontrar un plan en la última interacción
        const planFromLastMessage = this.findPlanInText(lastMessageText);
        if (planFromLastMessage) {
            return planFromLastMessage;
        }

        // Si no se encuentra en la última interacción, buscar en las últimas 3 mensajes
        const recentText = history.slice(-3).map(item => `${item.user} ${item.ai}`).join(' ').toLowerCase();
        const planFromRecentMessages = this.findPlanInText(recentText);
        if (planFromRecentMessages) {
            return planFromRecentMessages;
        }

        // Si todavía no encuentra nada, solo entonces buscar en todo el historial
        const allText = history.map(item => `${item.user} ${item.ai}`).join(' ').toLowerCase();
        const planFromAllHistory = this.findPlanInText(allText);
        if (planFromAllHistory) {
            return planFromAllHistory;
        }

        // Default - Plan más básico de internet si no se encuentra nada
        const defaultPlan = this.internetPlans[0];
        return {
            name: `Internet ${defaultPlan.name}`,
            price: `$${defaultPlan.price.toLocaleString('es-CO')}/mes`,
            id: defaultPlan.id,
            speed: defaultPlan.speed
        };
    }

    /**
     * Busca un plan específico en un texto dado
     * Método auxiliar para extractPlanFromHistory
     */
    private findPlanInText(text: string): any | null {
        // Planes de internet
        for (const plan of this.internetPlans) {
            if (text.includes(plan.name.toLowerCase()) ||
                text.includes(plan.speed.toLowerCase())) {
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
            if (text.includes(combo.name.toLowerCase()) ||
                text.includes(combo.description.toLowerCase())) {
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
            if (text.includes(tv.name.toLowerCase()) ||
                text.includes('tv hd') ||
                text.includes('televisión')) {
                return {
                    name: tv.name,
                    price: `$${tv.price.toLocaleString('es-CO')}/mes`,
                    id: tv.id,
                    channels: tv.channels
                };
            }
        }

        // Si no encuentra nada, devuelve null
        return null;
    }    /**
     * Obtiene los datos de planes para enviar a la IA
     */
    private getPlansData() {
        return {
            internetPlans: this.internetPlans,
            tvPlans: this.tvPlans,
            comboPlan: this.comboPlan
        };
    }    /**
     * Verifica si el cliente quiere proceder con instalación y crea ticket si es necesario
     */
    private async checkForTicketCreation(user: User, userMessage: string, aiResponse: string, session: SessionData): Promise<void> {
        // Usar IA para detectar intención de crear ticket
        const ticketDetectionPrompt = `
Analiza esta conversación de ventas y determina si el cliente quiere:
1. Crear una cotización/propuesta formal
2. Proceder con instalación/contratación
3. Que un técnico lo visite
4. Hacer una consulta más formal

Conversación:
Cliente: "${userMessage}"
Asesora: "${aiResponse}"

Responde SOLO con:
- "TICKET_COTIZACION" si quiere cotización formal
- "TICKET_INSTALACION" si quiere instalar/contratar
- "TICKET_CONSULTA" si quiere consulta técnica
- "NO_TICKET" si solo está consultando información

Respuesta:`;

        try {
            const response = await this.azureOpenAIService.sendMessage(ticketDetectionPrompt);

            if (response.success) {
                const action = response.message.trim().toUpperCase();

                if (action.includes('TICKET_')) {
                    await this.createTicketBasedOnAction(user, userMessage, aiResponse, session, action);
                }
            }
        } catch (error) {
            console.error('Error detectando necesidad de ticket:', error);
            // Fallback a detección por palabras clave
            const installationKeywords = [
                'instalar', 'instalación', 'contratar', 'cotización', 'propuesta',
                'agendar', 'programar', 'técnico', 'visita'
            ];

            const needsTicket = installationKeywords.some(keyword =>
                userMessage.toLowerCase().includes(keyword) ||
                aiResponse.toLowerCase().includes(keyword)
            );

            if (needsTicket) {
                await this.createTicketBasedOnAction(user, userMessage, aiResponse, session, 'TICKET_INSTALACION');
            }
        }
    }

    /**
     * Crea ticket basado en la acción detectada
     */
    private async createTicketBasedOnAction(user: User, userMessage: string, aiResponse: string, session: SessionData, action: string): Promise<void> {
        try {
            const planInfo = this.extractPlanFromConversation(session.salesHistory || []);

            let category = 'consulta';
            let priority = 'media';
            let description = '';

            switch (action) {
                case 'TICKET_COTIZACION':
                    category = 'cotizacion';
                    priority = 'alta';
                    description = `Solicitud de cotización formal - ${planInfo.planName}`;
                    break;
                case 'TICKET_INSTALACION':
                    category = 'instalacion';
                    priority = 'alta';
                    description = `Solicitud de instalación - ${planInfo.planName}`;
                    break;
                case 'TICKET_CONSULTA':
                    category = 'consulta';
                    priority = 'media';
                    description = `Consulta técnica sobre servicios`;
                    break;
            }

            const ticketData = {
                customerId: user.phoneNumber,
                description: `${description}\nPrecio: $${planInfo.price}\nDetalles: ${planInfo.description}\n\nConversación:\nCliente: ${userMessage}\nAsistente: ${aiResponse}`,
                category: category,
                priority: priority as 'alta' | 'media' | 'baja',
                source: 'whatsapp_sales_bot'
            };

            const ticketId = await this.ticketService.createTicket(ticketData);

            if (ticketId) {
                // Usar IA para generar respuesta de confirmación de ticket
                const confirmationPrompt = `El cliente acaba de solicitar ${description.toLowerCase()}. Se creó el ticket #${ticketId}. Genera un mensaje de confirmación profesional y amigable explicando los próximos pasos.`;

                const confirmationResponse = await this.azureOpenAIService.sendMessage(confirmationPrompt);

                if (confirmationResponse.success) {
                    await this.messageService.sendTextMessage(user.phoneNumber, confirmationResponse.message);
                } else {
                    // Fallback
                    await this.messageService.sendTextMessage(
                        user.phoneNumber,
                        `✅ ¡Perfecto! He creado tu solicitud.\n\n📋 **Ticket #${ticketId}**\n📞 Nuestro equipo te contactará pronto.\n\n¿Hay algo más en lo que pueda ayudarte?`
                    );
                }
            }
        } catch (error) {
            console.error('Error creando ticket automático:', error);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '📞 Perfecto, un asesor te contactará pronto para continuar con el proceso.'
            );
        }
    }/**
     * Extrae información del plan de la conversación
     */
    private extractPlanFromConversation(salesHistory: any[]): { planName: string, price: string, description: string } {
        const recentMessages = salesHistory.slice(-3); // Últimos 3 mensajes
        let planName = 'Plan personalizado';
        let price = 'Por definir';
        let description = 'Según conversación con cliente';

        // Buscar menciones de planes de internet
        for (const plan of this.internetPlans) {
            const planMentioned = recentMessages.some(msg =>
                msg.ai.toLowerCase().includes(plan.name.toLowerCase()) ||
                msg.ai.includes(plan.price.toString()) ||
                msg.user.toLowerCase().includes(plan.name.toLowerCase().split(' ')[0])
            );

            if (planMentioned) {
                planName = plan.name;
                price = plan.price.toString();
                description = plan.description;
                break;
            }
        }

        // Buscar menciones de combos
        if (planName === 'Plan personalizado') {
            for (const combo of this.comboPlan) {
                const comboMentioned = recentMessages.some(msg =>
                    msg.ai.toLowerCase().includes(combo.name.toLowerCase()) ||
                    msg.ai.includes(combo.comboPrice.toString()) ||
                    msg.user.toLowerCase().includes('combo')
                );

                if (comboMentioned) {
                    planName = combo.name;
                    price = combo.comboPrice.toString();
                    description = combo.description;
                    break;
                }
            }
        }

        return { planName, price, description };
    }
}

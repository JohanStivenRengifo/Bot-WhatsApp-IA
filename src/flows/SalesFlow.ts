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
    }/**
     * Verifica si este flujo debe manejar el mensaje actual
     */    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        // Si acabamos de completar una contratación (últimos 2 minutos), manejar mensajes de cortesía
        if ((session as any).contractCompletedAt) {
            const timeSinceCompletion = Date.now() - (session as any).contractCompletedAt.getTime();
            if (timeSinceCompletion < 120000) { // 2 minutos
                const courtesyMessages = ['gracias', 'thank', 'ok', 'perfecto', 'excelente', 'muy bien', 'genial'];
                if (courtesyMessages.some(word => message.toLowerCase().includes(word))) {
                    return true;
                }
            } else {
                // Limpiar el estado después de 2 minutos
                delete (session as any).contractCompletedAt;
            }
        }

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
    }    /**
     * Maneja el mensaje del usuario
     */    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Manejar mensajes de cortesía después de contratación exitosa
            if ((session as any).contractCompletedAt) {
                const timeSinceCompletion = Date.now() - (session as any).contractCompletedAt.getTime();
                if (timeSinceCompletion < 120000) { // 2 minutos
                    const courtesyMessages = ['gracias', 'thank', 'ok', 'perfecto', 'excelente', 'muy bien', 'genial'];
                    if (courtesyMessages.some(word => message.toLowerCase().includes(word))) {
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            `¡De nada! Fue un placer ayudarte con tu contratación. 😊\n\nSi necesitas algo más en el futuro, escribe "menu" para ver todas las opciones disponibles.\n\n¡Bienvenido a la familia Conecta2! 🎉`
                        );

                        // Limpiar completamente la sesión después de responder
                        delete (session as any).contractCompletedAt;
                        session.flowActive = undefined;
                        session.salesConversationStarted = false;
                        session.selectedService = undefined;

                        return true;
                    }
                } else {
                    // Limpiar el estado después de 2 minutos
                    delete (session as any).contractCompletedAt;
                }
            }

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
            }

            // Verificar si hay una respuesta predefinida para esta consulta
            const predefinedResponse = this.getPredefinedResponse(message);
            if (predefinedResponse) {
                // Enviar respuesta predefinida sin usar IA
                await this.messageService.sendTextMessage(user.phoneNumber, predefinedResponse);

                // Guardar en historial
                session.salesHistory.push({
                    user: message,
                    ai: predefinedResponse,
                    timestamp: new Date()
                });

                return true;
            }            // Usar Azure OpenAI para respuesta inteligente
            const context = this.buildSalesContext(user, session);

            try {
                // Obtener respuesta de Azure OpenAI
                const response = await this.azureOpenAIService.getSalesResponse(message, context);

                if (response.success) {
                    // Enviar respuesta al usuario
                    await this.messageService.sendTextMessage(user.phoneNumber, response.message);

                    // Guardar en historial
                    session.salesHistory.push({
                        user: message,
                        ai: response.message,
                        timestamp: new Date()
                    });
                } else {
                    throw new Error(response.error || 'Error en respuesta de IA');
                }
            } catch (error) {
                // Si falla la IA, usar respuesta de fallback
                console.error('Error obteniendo respuesta de Azure OpenAI:', error);
                const fallbackResponse = this.getFallbackResponse(message);

                // Enviar respuesta de fallback
                await this.messageService.sendTextMessage(user.phoneNumber, fallbackResponse);

                // Guardar en historial
                session.salesHistory.push({
                    user: message,
                    ai: fallbackResponse,
                    timestamp: new Date()
                });
            }

            return true;
        } catch (error) {
            console.error('Error en SalesFlow:', error);

            // Usar el nuevo sistema de notificaciones si está disponible
            try {
                const NotificationService = require('../services/NotificationService').default;
                const notificationService = NotificationService.getInstance();
                await notificationService.sendErrorAlert(error as Error, {
                    flow: 'SalesFlow',
                    user: user.phoneNumber,
                    session: session.flowActive
                });
            } catch (notificationError) {
                console.error('Error enviando notificación:', notificationError);
            }

            await this.messageService.sendTextMessage(
                user.phoneNumber,
                'Lo siento, ha ocurrido un error al procesar tu solicitud. Nuestro equipo técnico ha sido notificado y trabajará para solucionarlo pronto.\n\n¿Te gustaría que te conecte con un agente humano?'
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
        );        // Contexto mínimo viable para reducir tokens enviados a la IA
        let context = `
INFORMACIÓN ESENCIAL:
Eres Andrea, asesora comercial de Conecta2 Telecomunicaciones (Piendamó, Cauca, Colombia).
${ventaCerrada ? '⚠️ NOTA IMPORTANTE: EL CLIENTE YA SOLICITÓ UNA PROPUESTA O CONTRATACIÓN. Confirma esto y finaliza amablemente.' : ''}

PLANES DISPONIBLES (precios exactos, no modificar):
INTERNET: 30Mbps($40k), 50Mbps($50k), 60Mbps($60k), 70Mbps($68k), 80Mbps($75k), 100Mbps($80k)
TV: TV Completo ($40k, 85+ canales HD)
COMBOS: Básico(30Mbps+TV=$60k, ahorro $20k), Familiar(50Mbps+TV=$70k, ahorro $20k), Premium(100Mbps+TV=$100k, ahorro $20k)

INSTRUCCIONES:
- Sé amigable y directo, no insistente
- Respuestas breves (máx 3-4 líneas)
- Si no sabes algo, sugiere contactar a un agente
- Para consultas sobre precios, instalación o cobertura, usa los datos exactos
`;

        // Agregar solo las últimas 2 interacciones para reducir tokens
        if (session.salesHistory && session.salesHistory.length > 0) {
            context += '\nÚLTIMAS INTERACCIONES:\n';
            session.salesHistory.slice(-2).forEach(item => {
                // Limitar la longitud de los mensajes para reducir tokens
                const userMsg = item.user.length > 100 ? item.user.substring(0, 100) + '...' : item.user;
                const aiMsg = item.ai.length > 100 ? item.ai.substring(0, 100) + '...' : item.ai;
                context += `Cliente: ${userMsg}\nAndrea: ${aiMsg}\n\n`;
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
                    break; case 'confirm':
                    if (message.toLowerCase().includes('s') || message.toLowerCase().includes('si')) {
                        // Guardar datos necesarios antes de crear el ticket
                        const planName = session.contractData.planName;

                        // Crear ticket de alta prioridad
                        await this.createSalesTicket(user, session);                        // Enviar mensaje de confirmación usando los datos guardados
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
                        session.salesHistory = [];
                        session.step = undefined;
                        session.awaitingServiceSelection = false;
                        // Agregar estado temporal para manejar mensajes de cortesía
                        (session as any).contractCompletedAt = new Date();

                        // Limpiar cualquier otro flag activo
                        session.changingPassword = false;
                        session.creatingTicket = false;
                        session.consultingInvoices = false;
                        session.upgradingPlan = false;
                        session.verifyingPayment = false;

                        console.log('✅ Flujo de ventas cerrado completamente después de crear el ticket');
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
     * Genera mensaje de bienvenida personalizado para ventas
     */    private async getWelcomeSalesMessage(user: User, session: SessionData): Promise<string> {
        // Mensaje de bienvenida más directo y conciso
        const welcomeMessage = `¡Hola! 👋 Soy Andrea de Conecta2 Telecomunicaciones.

Tenemos los mejores planes de fibra óptica:

🚀 Internet: desde $40.000/mes (50/20 Mbps)
📺 TV HD: $40.000/mes (85+ canales)
🔥 Combos: desde $60.000/mes (con descuentos hasta $20.000)

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
    }    /**
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
    }

    /**
     * Proporciona respuestas predefinidas para preguntas frecuentes sin usar IA
     * @param message Mensaje del usuario
     * @returns Respuesta predefinida o null si no hay coincidencia
     */
    private getPredefinedResponse(message: string): string | null {
        const normalizedMessage = message.toLowerCase().trim();

        // Preguntas sobre precios de planes de internet
        if (normalizedMessage.includes('precio') || normalizedMessage.includes('costo') || normalizedMessage.includes('valor') || normalizedMessage.includes('cuánto')) {
            // Planes específicos
            for (const plan of this.internetPlans) {
                if (normalizedMessage.includes(plan.name.toLowerCase())) {
                    return `El plan de Internet ${plan.name} tiene un costo de $${plan.price.toLocaleString('es-CO')} mensuales, con velocidad de ${plan.speed}. ${plan.description} 💯\n\n¿Te gustaría contratar este plan o conocer más detalles?`;
                }
            }

            // TV
            if (normalizedMessage.includes('tv') || normalizedMessage.includes('televisión') || normalizedMessage.includes('television')) {
                const tvPlan = this.tvPlans[0];
                return `El plan de ${tvPlan.name} tiene un costo de $${tvPlan.price.toLocaleString('es-CO')} mensuales e incluye ${tvPlan.channels} 📺\n\n¿Te interesa contratar este servicio?`;
            }

            // Combos
            for (const combo of this.comboPlan) {
                if (normalizedMessage.includes(combo.name.toLowerCase()) || normalizedMessage.includes(combo.description.toLowerCase())) {
                    return `El ${combo.name} (${combo.description}) tiene un costo de $${combo.comboPrice.toLocaleString('es-CO')} mensuales. ¡Un ahorro de $${(combo.originalPrice - combo.comboPrice).toLocaleString('es-CO')} mensuales! 🔥\n\n¿Te gustaría contratar este combo?`;
                }
            }

            // Precios en general (si no especificó un plan)
            return `📊 **Precios de nuestros planes:**\n\n` +
                `**Internet:**\n` +
                this.internetPlans.map(p => `• ${p.name}: $${p.price.toLocaleString('es-CO')}/mes (${p.speed})`).join('\n') +
                `\n\n**TV:**\n• ${this.tvPlans[0].name}: $${this.tvPlans[0].price.toLocaleString('es-CO')}/mes (${this.tvPlans[0].channels})` +
                `\n\n**Combos (con descuento):**\n` +
                this.comboPlan.map(c => `• ${c.name}: $${c.comboPrice.toLocaleString('es-CO')}/mes (${c.description})`).join('\n') +
                `\n\n¿Cuál de estos planes te interesa más? 😊`;
        }

        // Preguntas sobre cobertura
        if (normalizedMessage.includes('cobertura') || normalizedMessage.includes('zona') || normalizedMessage.includes('barrio') ||
            normalizedMessage.includes('disponible') || normalizedMessage.includes('llega')) {
            return `Actualmente tenemos cobertura en Piendamó y zonas aledañas en el Cauca. Para verificar disponibilidad exacta en tu dirección, necesitaría que me indiques tu ubicación específica.\n\n¿Me podrías proporcionar tu dirección para verificar la cobertura? 🏠`;
        }

        // Preguntas sobre instalación
        if (normalizedMessage.includes('instala') || normalizedMessage.includes('demora') || normalizedMessage.includes('tiempo') ||
            normalizedMessage.includes('cuando') || normalizedMessage.includes('cuándo') || normalizedMessage.includes('cuanto tarda')) {
            return `La instalación de nuestros servicios se realiza en un plazo de 1 a 3 días hábiles después de la contratación. El proceso de instalación toma aproximadamente 2 horas.\n\n¿Te gustaría agendar una instalación? 🔧`;
        }

        // Preguntas sobre ventajas/beneficios
        if (normalizedMessage.includes('ventaja') || normalizedMessage.includes('beneficio') || normalizedMessage.includes('mejor') ||
            normalizedMessage.includes('diferencia') || normalizedMessage.includes('por qué elegir') || normalizedMessage.includes('por que elegir')) {
            return `✨ **Ventajas de Conecta2 Telecomunicaciones:**\n\n` +
                `• **Fibra óptica 100%** - Conexión estable y de alta velocidad\n` +
                `• **Soporte técnico 24/7** - Siempre disponibles para ayudarte\n` +
                `• **Sin cláusulas de permanencia** - Libertad total\n` +
                `• **Instalación rápida** - En 1-3 días hábiles\n` +
                `• **Precios competitivos** - La mejor relación calidad-precio\n\n` +
                `¿Qué plan te interesaría contratar? 🚀`;
        }

        // Si no hay coincidencia, devolver null para usar IA
        return null;
    }

    /**
     * Proporciona una respuesta de fallback cuando falla la IA
     * Ayuda a reducir costos al no requerir reintentos de IA
     */
    private getFallbackResponse(message: string): string {
        // Verificar si el mensaje contiene preguntas comunes
        const normalizedMessage = message.toLowerCase().trim();

        if (normalizedMessage.includes('hola') || normalizedMessage.includes('buenas') ||
            normalizedMessage.length < 10) {
            return `¡Hola! Soy Andrea de Conecta2 Telecomunicaciones. Estoy aquí para ayudarte con nuestros planes de internet y TV. ¿En qué puedo ayudarte hoy? 😊`;
        }

        if (normalizedMessage.includes('gracias') || normalizedMessage.includes('ok') ||
            normalizedMessage.includes('entiendo')) {
            return `¡De nada! Estoy para servirte. ¿Hay algo más en lo que pueda ayudarte con nuestros planes?`;
        }

        // Respuesta genérica que invita a elegir un plan
        return `Gracias por tu mensaje. En Conecta2 Telecomunicaciones tenemos excelentes planes de internet desde $40.000/mes y combos con TV desde $60.000/mes.\n\n¿Te gustaría conocer más detalles sobre algún plan específico? O si prefieres, puedo ayudarte a encontrar el plan ideal según tus necesidades. 🌟`;
    }
}

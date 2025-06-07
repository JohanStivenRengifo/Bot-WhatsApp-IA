import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService, TicketService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo completamente autónomo para mejora de planes de internet y adición de planes de TV
 * No utiliza SalesFlow ni servicios de IA - Maneja todo internamente
 */
export class PlanUpgradeFlow extends BaseConversationFlow {
    readonly name: string = 'planUpgrade';

    private customerService: CustomerService;
    private ticketService: TicketService;

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
    ];

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService,
        ticketService: TicketService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
        this.ticketService = ticketService;
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Si el flujo ya está activo (activado por ClientMenuFlow)
        if (session.flowActive === 'planUpgrade') {
            return user.authenticated;
        }

        // Este flujo maneja únicamente mejoras de plan autónomas
        const extractedCommand = extractMenuCommand(message); return (
            user.authenticated &&
            (extractedCommand === 'mejorar_plan' ||
                isMenuCommand(message, ['plan_upgrade', 'upgrade_plan', 'mejora_plan', 'mejorar plan', '⬆️ mejorar plan']) ||
                session.upgradingPlan === true)
        );
    }/**
     * Maneja el proceso completo de mejora de planes de forma autónoma
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Verificar que el usuario tenga servicio activo
            const userData = this.decodeUserData(user);
            if (userData?.isInactive) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '⚠️ Tu servicio está actualmente inactivo.\n\n' +
                    'Para solicitar cambios de plan, primero debes regularizar tu cuenta.\n\n' +
                    'Te recomendamos:\n' +
                    '1️⃣ Verificar el estado de tu facturación\n' +
                    '2️⃣ Realizar el pago pendiente si lo hubiera\n' +
                    '3️⃣ Contactar a nuestro equipo de atención al cliente');
                return true;
            }            // Inicializar flujo si no está activo o continuar si ya fue activado
            if (!session.upgradingPlan) {
                return await this.initializePlanUpgrade(user, session);
            } else if (!session.step) {
                // El flujo ya está activo pero no tiene step definido (recién activado por ClientMenuFlow)
                return await this.initializePlanUpgrade(user, session);
            }

            // Procesar según el paso actual del flujo
            switch (session.step) {
                case 'plan_type_selection':
                    return await this.handlePlanTypeSelection(user, message, session);
                case 'internet_plan_selection':
                    return await this.handleInternetPlanSelection(user, message, session);
                case 'tv_plan_selection':
                    return await this.handleTVPlanSelection(user, message, session);
                case 'confirmation':
                    return await this.handleConfirmation(user, message, session);
                default:
                    return await this.initializePlanUpgrade(user, session);
            }

        } catch (error) {
            console.error('Error en flujo de mejora de plan:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ha ocurrido un error al procesar tu solicitud. Por favor, intenta nuevamente.');

            // Limpiar estado de sesión
            this.resetPlanUpgradeSession(session);
            return true;
        }
    }    /**
     * Inicializa el proceso de mejora de plan obteniendo información real del cliente
     */
    private async initializePlanUpgrade(user: User, session: SessionData): Promise<boolean> {
        // Obtener información actual del cliente
        let clientName = "cliente";
        let currentPlan = "No disponible";

        try {
            // Obtener nombre del cliente de los datos encriptados
            if (user.encryptedData) {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                if (decryptedData.customerName) {
                    clientName = decryptedData.customerName.split(' ')[0];
                }
            }

            // Obtener plan actual del cliente desde WispHub
            const planData = await this.customerService.getCustomerPlan(user.customerId!);
            if (planData) {
                currentPlan = `${planData.name} - ${planData.speed} - $${planData.price.toLocaleString()}`;
            }

        } catch (error) {
            console.error('Error obteniendo información del cliente:', error);
            currentPlan = "No se pudo obtener información del plan actual";
        }

        // Activar el flujo de mejora de plan
        session.upgradingPlan = true;
        session.step = 'plan_type_selection';

        // Menú interactivo principal con opciones de mejora
        const planTypeMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '⬆️ Mejora tu Servicio'
                },
                body: {
                    text: `Hola ${clientName}, vamos a mejorar tu plan de servicios.\n\n` +
                        `📊 **Tu plan actual:**\n${currentPlan}\n\n` +
                        `¿Qué tipo de mejora te interesa?`
                },
                footer: {
                    text: 'Conecta2 Telecomunicaciones - Siempre conectados'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'upgrade_internet',
                                title: '🚀 Mejorar Internet'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'add_tv',
                                title: '📺 Agregar TV'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'combo_plan',
                                title: '📦 Plan Combo'
                            }
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(planTypeMenu);
        return true;
    }    /**
     * Maneja la selección del tipo de plan de forma inteligente
     */
    private async handlePlanTypeSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        // Normalizar el mensaje para reconocer tanto IDs como texto
        let selectedOption = message;

        // Mapear texto alternativo a IDs válidos
        const messageText = message.toLowerCase().trim();
        if (messageText.includes('internet') || messageText.includes('mejorar') || messageText.includes('🚀')) {
            selectedOption = 'upgrade_internet';
        } else if (messageText.includes('tv') || messageText.includes('televisión') || messageText.includes('📺')) {
            selectedOption = 'add_tv';
        } else if (messageText.includes('combo') || messageText.includes('📦')) {
            selectedOption = 'combo_plan';
        }

        const validSelections = ['upgrade_internet', 'add_tv', 'combo_plan'];

        if (!validSelections.includes(selectedOption)) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Opción no válida. Por favor, selecciona una opción del menú anterior.');
            return true;
        }

        // Guardar la selección en la sesión
        session.planType = selectedOption;

        // Redirigir según el tipo seleccionado
        switch (selectedOption) {
            case 'upgrade_internet':
                return await this.showInternetUpgradeOptions(user, session);
            case 'add_tv':
                return await this.showTVPlanOptions(user, session);
            case 'combo_plan':
                return await this.showComboPlanOptions(user, session);
            default:
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Selección no reconocida. Iniciando proceso nuevamente...');
                return await this.initializePlanUpgrade(user, session);
        }
    }/**
     * Muestra opciones de mejora de internet usando los planes configurados
     */
    private async showInternetUpgradeOptions(user: User, session: SessionData): Promise<boolean> {
        session.step = 'internet_plan_selection';

        // Obtener plan actual para mostrar solo planes superiores
        let currentSpeed = 0;
        try {
            const currentPlan = await this.customerService.getCustomerPlan(user.customerId!);
            if (currentPlan && currentPlan.speed) {
                // Extraer velocidad del string "100/50 Mbps"
                const speedMatch = currentPlan.speed.match(/(\d+)/);
                if (speedMatch) {
                    currentSpeed = parseInt(speedMatch[1]);
                }
            }
        } catch (error) {
            console.error('Error obteniendo plan actual:', error);
        }

        // Filtrar planes superiores al actual
        const availablePlans = this.internetPlans.filter(plan => {
            const planSpeed = parseInt(plan.speed.split('/')[0]);
            return planSpeed > currentSpeed;
        });

        if (availablePlans.length === 0) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🎉 ¡Excelente! Ya tienes nuestro plan de mayor velocidad.\n\n' +
                'Si necesitas más velocidad, nuestro equipo comercial puede evaluar opciones empresariales especiales.\n\n' +
                '¿Te gustaría que te contacten para evaluar opciones personalizadas?');

            session.step = 'confirmation';
            session.selectedPlanId = 'enterprise_contact';
            return true;
        }

        // Crear lista interactiva con planes disponibles
        const sections = [{
            title: 'Planes Disponibles',
            rows: availablePlans.map(plan => ({
                id: plan.id,
                title: `🚀 ${plan.name}`,
                description: `${plan.speed} - $${plan.price.toLocaleString()}/mes`
            }))
        }];

        const internetPlansMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🚀 Planes de Internet Disponibles'
                },
                body: {
                    text: 'Selecciona el plan de internet que mejor se adapte a tus necesidades:\n\n' +
                        '✅ Todos los planes incluyen:\n' +
                        '• Fibra óptica de alta velocidad\n' +
                        '• Sin límite de datos\n' +
                        '• Soporte técnico 24/7\n' +
                        '• Instalación sin costo'
                },
                footer: {
                    text: 'Mejora disponible desde hoy'
                },
                action: {
                    button: 'Seleccionar Plan',
                    sections: sections
                }
            }
        };

        await this.messageService.sendMessage(internetPlansMenu);
        return true;
    }    /**
     * Muestra opciones de planes de TV usando la configuración estática
     */
    private async showTVPlanOptions(user: User, session: SessionData): Promise<boolean> {
        session.step = 'tv_plan_selection';

        // Crear lista interactiva con planes de TV disponibles
        const sections = [{
            title: 'Planes de TV Disponibles',
            rows: this.tvPlans.map(plan => ({
                id: plan.id,
                title: `📺 ${plan.name}`,
                description: `${plan.channels} - $${plan.price.toLocaleString()}/mes`
            }))
        }];

        const tvPlansMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '📺 Planes de Televisión'
                },
                body: {
                    text: 'Selecciona el plan de TV que más te guste:\n\n' +
                        '✅ Todos los planes incluyen:\n' +
                        '• Señal en alta definición (HD)\n' +
                        '• Decodificador incluido\n' +
                        '• Instalación sin costo\n' +
                        '• Soporte técnico 24/7'
                },
                footer: {
                    text: 'Disfruta del mejor entretenimiento'
                },
                action: {
                    button: 'Seleccionar TV',
                    sections: sections
                }
            }
        };

        await this.messageService.sendMessage(tvPlansMenu);
        return true;
    }    /**
     * Muestra opciones de planes combo con descuentos especiales
     */
    private async showComboPlanOptions(user: User, session: SessionData): Promise<boolean> {
        session.step = 'internet_plan_selection'; // Reutilizamos el mismo paso para combos

        // Crear lista interactiva con combos disponibles
        const sections = [{
            title: 'Combos Disponibles', rows: this.comboPlan.map(combo => ({
                id: combo.id,
                title: `📦 ${combo.name}`,
                description: `${combo.description} - $${combo.comboPrice.toLocaleString()}/mes${combo.discount < 0 ? '' : ` (Ahorras $${combo.discount.toLocaleString()})`}`
            }))
        }];

        const comboPlansMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '📦 Planes Combo - ¡Ofertas Especiales!'
                },
                body: {
                    text: '¡Aprovecha nuestros descuentos en planes combo!\n\n' +
                        'Internet + TV con beneficios especiales:\n\n' +
                        '✅ Beneficios incluidos:\n' +
                        '• Descuento especial por combo\n' +
                        '• Una sola factura\n' +
                        '• Instalación sin costo\n' +
                        '• Soporte técnico integral'
                },
                footer: {
                    text: 'Ahorra hasta $25.000 al mes'
                },
                action: {
                    button: 'Seleccionar Combo',
                    sections: sections
                }
            }
        };

        await this.messageService.sendMessage(comboPlansMenu);
        return true;
    }    /**
     * Maneja la selección de planes de internet y combos usando configuración estática
     */
    private async handleInternetPlanSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        // Buscar en planes de internet
        let selectedPlan = this.internetPlans.find(plan => plan.id === message);
        let planType = 'internet';

        // Si no se encuentra, buscar en combos
        if (!selectedPlan) {
            const selectedCombo = this.comboPlan.find(combo => combo.id === message);
            if (selectedCombo) {
                selectedPlan = {
                    id: selectedCombo.id,
                    name: selectedCombo.name,
                    speed: selectedCombo.description,
                    price: selectedCombo.comboPrice,
                    description: selectedCombo.discount < 0 ?
                        `Incluye servicios adicionales por $${Math.abs(selectedCombo.discount).toLocaleString()} extra` :
                        `Ahorro de $${selectedCombo.discount.toLocaleString()} vs planes separados`
                };
                planType = 'combo';
            }
        }

        // Manejar caso especial de contacto empresarial
        if (message === 'enterprise_contact') {
            session.selectedPlanId = message;
            session.step = 'confirmation';

            await this.messageService.sendTextMessage(user.phoneNumber,
                '🏢 **Contacto Empresarial Solicitado**\n\n' +
                'Perfecto, nuestro equipo comercial se pondrá en contacto contigo para evaluar opciones empresariales personalizadas.\n\n' +
                '¿Confirmas que deseas que te contacten para evaluar planes empresariales?\n\n' +
                'Responde "**confirmar**" para proceder o "**cancelar**" para terminar.');
            return true;
        }

        if (!selectedPlan) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Opción no válida. Por favor, selecciona una opción del menú.');
            return true;
        }

        session.selectedPlanId = message;
        session.step = 'confirmation';

        // Construir mensaje de confirmación
        let confirmationMessage = `✅ **Plan Seleccionado:**\n\n`;
        confirmationMessage += `📋 **Nombre:** ${selectedPlan.name}\n`;
        confirmationMessage += `🚀 **Descripción:** ${selectedPlan.speed}\n`;
        confirmationMessage += `💰 **Precio:** $${selectedPlan.price.toLocaleString()}/mes\n`;

        if (planType === 'combo' && selectedPlan.description) {
            confirmationMessage += `💡 **Beneficio:** ${selectedPlan.description}\n`;
        }

        confirmationMessage += `\n¿Confirmas que deseas solicitar este ${planType === 'combo' ? 'combo' : 'plan'}?\n\n`;
        confirmationMessage += `Responde "**confirmar**" para proceder o "**cancelar**" para terminar.`;

        await this.messageService.sendTextMessage(user.phoneNumber, confirmationMessage);
        return true;
    }    /**
     * Maneja la selección de planes de TV usando configuración estática
     */
    private async handleTVPlanSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        const selectedTVPlan = this.tvPlans.find(plan => plan.id === message);

        if (!selectedTVPlan) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Opción no válida. Por favor, selecciona una opción del menú.');
            return true;
        }

        session.selectedTVPlanId = message;
        session.step = 'confirmation';

        // Mostrar confirmación
        await this.messageService.sendTextMessage(user.phoneNumber,
            `✅ **Plan de TV Seleccionado:**\n\n` +
            `📺 **Nombre:** ${selectedTVPlan.name}\n` +
            `📡 **Canales:** ${selectedTVPlan.channels}\n` +
            `💰 **Precio:** $${selectedTVPlan.price.toLocaleString()}/mes\n` +
            `🎯 **Descripción:** ${selectedTVPlan.description}\n\n` +
            `¿Confirmas que deseas agregar este plan de TV?\n\n` +
            `Responde "**confirmar**" para proceder o "**cancelar**" para terminar.`);

        return true;
    }

    /**
     * Maneja la confirmación final
     */
    private async handleConfirmation(user: User, message: string, session: SessionData): Promise<boolean> {
        const messageText = message.toLowerCase().trim();

        if (messageText === 'confirmar' || messageText === 'si' || messageText === 'sí') {
            // Crear ticket para el cambio de plan
            await this.createPlanChangeTicket(user, session);
            return true;
        } else if (messageText === 'cancelar' || messageText === 'no') {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Solicitud cancelada.\n\n' +
                'Si cambias de opinión, puedes solicitar una mejora de plan en cualquier momento desde el menú principal.');

            this.resetPlanUpgradeSession(session);
            return true;
        } else {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❓ Por favor, responde "**confirmar**" para proceder o "**cancelar**" para terminar.');
            return true;
        }
    }    /**
     * Crea un ticket detallado para el cambio de plan usando información específica
     */
    private async createPlanChangeTicket(user: User, session: SessionData): Promise<void> {
        try {
            let clientName = "cliente";
            if (user.encryptedData) {
                try {
                    const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                    if (decryptedData.customerName) {
                        clientName = decryptedData.customerName;
                    }
                } catch (error) {
                    console.error('Error decrypting user data:', error);
                }
            }

            // Obtener información detallada del plan actual
            let currentPlanInfo = "No disponible";
            try {
                const currentPlan = await this.customerService.getCustomerPlan(user.customerId!);
                if (currentPlan) {
                    currentPlanInfo = `${currentPlan.name} - ${currentPlan.speed} - $${currentPlan.price.toLocaleString()}`;
                }
            } catch (error) {
                console.error('Error obteniendo plan actual:', error);
            }

            // Construir descripción detallada del ticket
            let ticketDescription = `SOLICITUD DE CAMBIO DE PLAN - WHATSAPP BOT\n`;
            ticketDescription += `${'='.repeat(50)}\n\n`;

            ticketDescription += `📋 INFORMACIÓN DEL CLIENTE:\n`;
            ticketDescription += `• Nombre: ${clientName}\n`;
            ticketDescription += `• Teléfono: ${user.phoneNumber}\n`;
            ticketDescription += `• ID Cliente: ${user.customerId}\n`;
            ticketDescription += `• Plan Actual: ${currentPlanInfo}\n\n`;

            ticketDescription += `🎯 SOLICITUD:\n`;
            ticketDescription += `• Tipo: ${this.getPlanTypeDescription(session.planType)}\n`;

            // Agregar detalles del plan solicitado
            if (session.selectedPlanId) {
                const planDetails = this.getPlanDetails(session.selectedPlanId);
                if (planDetails) {
                    ticketDescription += `• Plan Solicitado: ${planDetails.name}\n`;
                    ticketDescription += `• Descripción: ${planDetails.description}\n`;
                    ticketDescription += `• Precio: $${planDetails.price.toLocaleString()}/mes\n`;
                }
            }

            if (session.selectedTVPlanId) {
                const tvPlanDetails = this.tvPlans.find(plan => plan.id === session.selectedTVPlanId);
                if (tvPlanDetails) {
                    ticketDescription += `• Plan TV Solicitado: ${tvPlanDetails.name}\n`;
                    ticketDescription += `• Canales: ${tvPlanDetails.channels}\n`;
                    ticketDescription += `• Precio TV: $${tvPlanDetails.price.toLocaleString()}/mes\n`;
                }
            }

            ticketDescription += `\n📅 DETALLES DE SOLICITUD:\n`;
            ticketDescription += `• Fecha: ${new Date().toLocaleDateString('es-CO')}\n`;
            ticketDescription += `• Hora: ${new Date().toLocaleTimeString('es-CO')}\n`;
            ticketDescription += `• Canal: WhatsApp Bot\n`;
            ticketDescription += `• Estado: Pendiente de contacto comercial\n\n`;

            ticketDescription += `📞 ACCIONES REQUERIDAS:\n`;
            if (session.selectedPlanId === 'enterprise_contact') {
                ticketDescription += `• Contactar cliente para evaluar opciones empresariales\n`;
                ticketDescription += `• Preparar propuesta personalizada\n`;
            } else {
                ticketDescription += `• Contactar cliente para confirmar cambio\n`;
                ticketDescription += `• Coordinar instalación si es necesaria\n`;
                ticketDescription += `• Actualizar plan en sistema\n`;
            }

            // Crear el ticket usando el TicketService
            const ticketData = {
                subject: session.selectedPlanId === 'enterprise_contact'
                    ? 'Solicitud Consulta Empresarial - WhatsApp'
                    : 'Solicitud de Cambio de Plan - WhatsApp',
                description: ticketDescription,
                priority: 'media' as const,
                category: 'Cambio de Plan',
                customerId: user.customerId!,
                source: 'whatsapp',
                clientInfo: {
                    name: clientName,
                    phone: user.phoneNumber
                }
            };

            await this.ticketService.createTicket(ticketData);

            // Enviar confirmación personalizada al cliente
            await this.sendConfirmationMessage(user, session);

        } catch (error) {
            console.error('Error creando ticket de cambio de plan:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al enviar la solicitud. Por favor, intenta nuevamente o contacta a nuestro equipo de soporte.');
        } finally {            // Limpiar sesión
            this.resetPlanUpgradeSession(session);
        }
    }

    /**
     * Obtiene descripción del tipo de plan para el ticket
     */
    private getPlanTypeDescription(planType: string | undefined): string {
        switch (planType) {
            case 'upgrade_internet':
                return 'Mejora de Plan de Internet';
            case 'add_tv':
                return 'Adición de Plan de TV';
            case 'combo_plan':
                return 'Plan Combo (Internet + TV)';
            default:
                return 'Cambio de Plan';
        }
    }

    /**
     * Obtiene detalles completos de un plan por su ID
     */
    private getPlanDetails(planId: string): any {
        // Buscar en planes de internet
        let plan = this.internetPlans.find(p => p.id === planId);
        if (plan) {
            return {
                name: plan.name,
                description: plan.speed,
                price: plan.price
            };
        }

        // Buscar en combos
        const combo = this.comboPlan.find(c => c.id === planId);
        if (combo) {
            return {
                name: combo.name,
                description: combo.description,
                price: combo.comboPrice
            };
        }

        // Caso especial para contacto empresarial
        if (planId === 'enterprise_contact') {
            return {
                name: 'Consulta Empresarial',
                description: 'Evaluación de opciones empresariales personalizadas',
                price: 0
            };
        }

        return null;
    }

    /**
     * Envía mensaje de confirmación personalizado según el tipo de solicitud
     */
    private async sendConfirmationMessage(user: User, session: SessionData): Promise<void> {
        if (session.selectedPlanId === 'enterprise_contact') {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ **¡Solicitud de Consulta Empresarial Enviada!**\n\n' +
                `📋 **Tipo:** Consulta Empresarial\n` +
                `📅 **Fecha:** ${new Date().toLocaleDateString('es-CO')}\n` +
                `⏰ **Hora:** ${new Date().toLocaleTimeString('es-CO')}\n\n` +
                '🏢 **Nuestro equipo comercial empresarial se pondrá en contacto contigo**\n\n' +
                '📞 **Te contactaremos dentro de las próximas 4 horas hábiles** para evaluar tus necesidades específicas.\n\n' +
                '💼 **Prepararemos una propuesta personalizada** según tus requerimientos empresariales.\n\n' +
                '¡Gracias por considerar nuestros servicios empresariales! 🌟');
        } else {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ **¡Solicitud Enviada Exitosamente!**\n\n' +
                `📋 **Tipo:** ${this.getPlanTypeDescription(session.planType)}\n` +
                `📅 **Fecha:** ${new Date().toLocaleDateString('es-CO')}\n` +
                `⏰ **Hora:** ${new Date().toLocaleTimeString('es-CO')}\n\n` +
                '👥 **Tu solicitud será procesada por nuestro equipo comercial**\n\n' +
                '📞 **Te contactaremos dentro de las próximas 24 horas** para coordinar los detalles del cambio.\n\n' +
                '💡 **Importante:** El cambio se efectuará sin costo adicional de instalación si mantienes la misma tecnología.\n\n' +
                '🎉 **Beneficios adicionales:**\n' +
                '• Migración sin interrupción del servicio\n' +
                '• Soporte técnico durante el proceso\n' +
                '• Garantía de velocidad desde el primer día\n\n' + '¡Gracias por confiar en Conecta2 Telecomunicaciones! 🌟');
        }
    }    /**
     * Resetea el estado de sesión de mejora de plan
     */
    private resetPlanUpgradeSession(session: SessionData): void {
        session.upgradingPlan = false;
        session.planType = undefined;
        session.planCategory = undefined;
        session.selectedPlanId = undefined;
        session.selectedTVPlanId = undefined;
        session.step = undefined;
        session.flowActive = ''; // Limpiar estado de flujo activo
    }
}
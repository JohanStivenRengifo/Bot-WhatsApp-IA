import moment from 'moment';
import { User, WhatsAppMessage, SessionData, PaymentPoint, UpgradePlan } from '../interfaces';
import {
    MessageService,
    CustomerService,
    TicketService,
    PaymentService,
    AIService,
    SecurityService
} from '../services';
import { SessionManager } from '../services/SessionManager';
import {
    ConversationFlowManager,
    AuthenticationFlow,
    PrivacyPolicyFlow,
    TicketFlow,
    MainMenuFlow,
    ServiceReactivationFlow,
    InitialSelectionFlow,
    SalesFlow,
    TechnicalSupportFlow,
    InvoicesFlow,
    TicketCreationFlow,
    PasswordChangeFlow,
    GeneralSupportFlow,
    PaymentVerificationFlow,
    PlanUpgradeFlow,
    AdvisorTransferFlow,
    IPDiagnosticFlow,
    PaymentPointsFlow
} from '../flows';
import { isValidPassword } from '../utils';

export class MessageHandler {
    private users: Map<string, User> = new Map();
    private userSessions: Map<string, SessionData> = new Map();
    private messageService: MessageService;
    private customerService: CustomerService;
    private ticketService: TicketService;
    private paymentService: PaymentService;
    private aiService: AIService;
    private securityService: SecurityService;
    private flowManager: ConversationFlowManager;
    private sessionManager: SessionManager; constructor() {
        this.messageService = new MessageService();
        this.customerService = new CustomerService();
        this.ticketService = new TicketService();
        this.paymentService = new PaymentService();
        this.aiService = new AIService();
        this.securityService = new SecurityService();

        // Inicializar el gestor de sesiones
        this.sessionManager = new SessionManager(this.messageService);

        // Inicializar el gestor de flujos
        this.flowManager = new ConversationFlowManager();

        // Registrar los flujos de conversación
        this.registerConversationFlows();

        // Configurar limpieza periódica de sesiones expiradas
        setInterval(() => {
            this.sessionManager.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Cada 5 minutos
    }

    async processMessage(message: WhatsAppMessage): Promise<void> {
        const phoneNumber = message.from;
        const messageType = message.type;
        let messageText = '';

        // Check rate limiting first
        const rateLimitCheck = this.securityService.checkRateLimit(phoneNumber);
        if (!rateLimitCheck.allowed) {
            const resetTime = rateLimitCheck.resetTime;
            const waitMinutes = resetTime ? Math.ceil((resetTime.getTime() - new Date().getTime()) / (60 * 1000)) : 1;

            await this.messageService.sendTextMessage(phoneNumber,
                `⚠️ Has enviado demasiados mensajes muy rápido.\n\n` +
                `Por favor espera ${waitMinutes} minuto(s) antes de enviar otro mensaje.\n\n` +
                `Esta medida nos ayuda a mantener un servicio de calidad para todos nuestros usuarios.`);
            return;
        }

        // Check if user is blocked due to failed authentication attempts
        const blockStatus = this.securityService.isUserBlocked(phoneNumber);
        if (blockStatus.blocked) {
            await this.messageService.sendTextMessage(phoneNumber,
                `🔒 Tu cuenta está temporalmente bloqueada debido a múltiples intentos de autenticación fallidos.\n\n` +
                `⏰ Tiempo restante: ${blockStatus.remainingTime} minutos\n\n` +
                `Por tu seguridad, intenta nuevamente después de este tiempo.`);
            return;
        }

        // Extract message text based on type
        switch (messageType) {
            case 'text':
                messageText = message.text?.body || '';
                break;
            case 'interactive':
                messageText = message.interactive?.button_reply?.id ||
                    message.interactive?.list_reply?.id || '';
                break;
            default:
                messageText = 'unsupported_message_type';
        }

        // Get or create user
        let user = this.users.get(phoneNumber);
        if (!user) {
            user = {
                phoneNumber,
                authenticated: false,
                acceptedPrivacyPolicy: false
            };
            this.users.set(phoneNumber, user);
        }

        // Process message based on user state
        await this.handleUserMessage(user, messageText);
    } private async handleUserMessage(user: User, message: string): Promise<void> {
        try {
            // Verificar si necesita atención humana primero, antes de cualquier otro flujo
            const needsHuman = await this.customerService.needsHumanAssistance(message);
            if (needsHuman) {
                await this.handleHumanAssistanceRequest(user, message);
                return;
            }

            // Obtener o crear una sesión para este usuario
            let session = this.userSessions.get(user.phoneNumber);
            if (!session) {
                session = {
                    changingPassword: false,
                    creatingTicket: false,
                    handlingReactivation: false
                };
                this.userSessions.set(user.phoneNumber, session);
            }

            // Si el usuario está autenticado, validar sesión
            if (user.authenticated) {
                const sessionValidation = this.securityService.validateSession(user.phoneNumber);
                if (!sessionValidation.valid) {
                    // Sesión expirada, requiere re-autenticación
                    user.authenticated = false;
                    user.sessionId = undefined;
                    user.sessionExpiresAt = undefined;
                    this.users.set(user.phoneNumber, user);

                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '🔒 Tu sesión ha expirado por seguridad.\n\n' +
                        'Por favor, autentica nuevamente ingresando tu número de documento:');
                    return;
                }

                // Actualizar última actividad
                user.lastActivity = new Date();
                this.users.set(user.phoneNumber, user);                // Enviar recordatorio de sesión si quedan menos de 15 minutos
                if (sessionValidation.remainingTime && sessionValidation.remainingTime <= 15) {
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        `⏰ Tu sesión expirará en ${sessionValidation.remainingTime} minutos.\n\n` +
                        'Escribe cualquier mensaje para extender tu sesión automáticamente.');
                }
            }
            user.lastActivity = new Date();
            this.users.set(user.phoneNumber, user);

            // Main menu and commands
            // Procesar el mensaje a través del gestor de flujos
            const handled = await this.flowManager.processMessage(user, message, session);

            // Si ningún flujo manejó el mensaje, intentar procesarlo como una consulta de IA
            if (!handled) {
                await this.handleIntelligentResponse(user, message);
            }

            // Guardar el usuario y la sesión después de procesado el mensaje
            this.users.set(user.phoneNumber, user);
            this.userSessions.set(user.phoneNumber, session);
        } catch (error) {
            console.error('Error handling user message:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                'Ha ocurrido un error técnico. Por favor, intenta nuevamente en unos minutos.');
        }
    } private async handlePrivacyPolicyFlow(user: User, message: string): Promise<void> {
        if (message.toLowerCase().includes('acepto') || message === 'accept_privacy') {
            user.acceptedPrivacyPolicy = true;
            this.users.set(user.phoneNumber, user);

            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ Gracias por aceptar nuestras políticas.\n\n' +
                'Ahora necesito autenticarte para brindarte soporte personalizado.\n\n' +
                'Por favor, ingresa tu número de documento de identidad:');

            // Creamos una propiedad para indicar que está esperando un documento
            user.awaitingDocument = true;
            this.users.set(user.phoneNumber, user);
        } else if (message.toLowerCase().includes('no acepto') || message === 'reject_privacy') {
            // User rejected privacy policy
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🙏 Gracias por tu tiempo.\n\n' +
                'Respetamos tu decisión de no autorizar el tratamiento de tus datos personales.\n\n' +
                'Sin esta autorización no podemos brindarte nuestros servicios de soporte personalizado a través de este canal.\n\n' +
                'Si cambias de opinión en el futuro, puedes contactarnos nuevamente.\n\n' +
                '📞 Para asistencia general puedes llamar a nuestra línea de atención al cliente.\n\n' +
                '¡Que tengas un excelente día! 😊');

            // Remove user from active users since they rejected privacy policy
            this.users.delete(user.phoneNumber);

            // Clear any session data
            this.userSessions.delete(user.phoneNumber);
        } else {
            // User sent something else, show privacy policy again
            await this.messageService.sendPrivacyPolicyMessage(user.phoneNumber);
        }
    } private async handleAuthenticationFlow(user: User, message: string): Promise<void> {
        try {
            // Si ya validamos el formato en handleUserMessage, no necesitamos volver a validar
            if (user.awaitingDocument && !/^\d{6,12}$/.test(message)) {
                // Ya se mostró un mensaje de error en handleUserMessage
                return;
            }

            // Si el mensaje no cumple con el formato de documento y no estamos en modo de espera
            if (!user.awaitingDocument && !/^\d{6,12}$/.test(message)) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ El número de documento debe contener entre 6 y 12 dígitos numéricos.\n\n' +
                    'Por favor, ingresa solo los números de tu documento de identidad:');

                // Establecer el modo de espera para futuros mensajes
                user.awaitingDocument = true;
                this.users.set(user.phoneNumber, user);
                return;
            }

            // Quitar el estado de espera de documento
            user.awaitingDocument = false;
            this.users.set(user.phoneNumber, user);            // Authenticate user with WispHub
            const customerData = await this.customerService.authenticateCustomer(message);

            if (customerData) {
                // Verificar si el servicio está inactivo
                if (customerData.isInactive) {
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        `⚠️ Hola ${customerData.name},\n\n` +
                        `Hemos identificado que tu servicio se encuentra actualmente inactivo (Estado: ${customerData.status}).\n\n` +
                        `Para reactivar tu servicio o resolver cualquier inconveniente con tu cuenta, por favor:\n\n` +
                        `1️⃣ Contacta a nuestro equipo de atención al cliente\n` +
                        `2️⃣ Verifica si tienes pagos pendientes\n` +
                        `3️⃣ Consulta el estado de tu facturación\n\n` +
                        `¿Deseas que te ayude a revisar tu estado de cuenta?`);

                    // Crear una sesión temporal para este usuario
                    this.securityService.recordAuthAttempt(user.phoneNumber, true);

                    user.authenticated = true;
                    user.customerId = customerData.id;
                    user.sessionId = this.securityService.createSession(user.phoneNumber);
                    user.sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos de sesión limitada
                    user.lastActivity = new Date();

                    // Guardar datos encriptados pero marcar como inactivo
                    user.encryptedData = this.securityService.encryptSensitiveData(JSON.stringify({
                        customerId: customerData.id,
                        customerName: customerData.name,
                        isInactive: true
                    }));

                    this.users.set(user.phoneNumber, user);

                    // No mostrar menú principal completo, sino opciones limitadas
                    await this.messageService.sendLimitedOptionsMenu(user.phoneNumber);
                    return;
                }

                // Successful authentication for active users
                this.securityService.recordAuthAttempt(user.phoneNumber, true);

                user.authenticated = true;
                user.customerId = customerData.id;

                // Create secure session
                const sessionId = this.securityService.createSession(user.phoneNumber);
                user.sessionId = sessionId;
                user.sessionExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
                user.lastActivity = new Date();

                // Encrypt sensitive customer data
                user.encryptedData = this.securityService.encryptSensitiveData(JSON.stringify({
                    customerId: customerData.id,
                    customerName: customerData.name
                }));
                this.users.set(user.phoneNumber, user);

                await this.messageService.sendTextMessage(user.phoneNumber,
                    `✅ ¡Hola ${customerData.name}!\n\n` +
                    'Autenticación exitosa. Tu sesión estará activa por 2 horas.\n\n' +
                    '🔒 Sesión segura iniciada\n' +
                    '⏰ Expiración automática por seguridad');

                // Mostrar automáticamente el menú después de la autenticación exitosa
                await this.messageService.sendMainMenu(user.phoneNumber);
            } else {
                // Failed authentication
                const canRetry = this.securityService.recordAuthAttempt(user.phoneNumber, false);
                const remainingAttempts = this.securityService.getRemainingAuthAttempts(user.phoneNumber);

                if (!canRetry) {
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '🔒 Demasiados intentos fallidos de autenticación.\n\n' +
                        'Tu cuenta ha sido bloqueada temporalmente por 15 minutos por seguridad.\n\n' +
                        'Si necesitas ayuda inmediata, contacta a nuestro equipo de soporte.');
                } else {
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        `❌ No pude encontrar tu información o tu servicio no está activo.\n\n` +
                        `Verifica tu número de documento e intenta nuevamente.\n\n` +
                        `⚠️ Intentos restantes: ${remainingAttempts}\n\n` +
                        `Escribe "ayuda" para contactar a un agente.`);
                }
            }
        } catch (error) {
            console.error('Authentication error:', error);

            // Record failed attempt due to system error
            this.securityService.recordAuthAttempt(user.phoneNumber, false);

            await this.messageService.sendTextMessage(user.phoneNumber,
                'Error en la autenticación. Intenta nuevamente en unos momentos.');
        }
    }

    private async handleMainCommands(user: User, message: string): Promise<void> {
        const command = message.toLowerCase().trim();

        switch (command) {
            case 'menu':
            case 'inicio':
                await this.messageService.sendMainMenu(user.phoneNumber);
                break;

            case 'ping':
            case 'test_conexion':
                await this.handlePingRequest(user);
                break;

            case 'factura':
            case 'invoice':
                await this.handleInvoiceRequest(user);
                break;

            case 'deuda':
            case 'saldo':
                await this.handleDebtInquiry(user);
                break;

            case 'cambiar_clave':
            case 'password':
                await this.handlePasswordChange(user);
                break;

            case 'ticket':
            case 'soporte':
                await this.handleTicketCreation(user);
                break; case 'mejorar_plan':
            case 'upgrade':
                await this.handlePlanUpgrade(user);
                break;

            case 'puntos_pago':
            case 'payment_points':
                await this.handlePaymentPoints(user);
                break;

            case 'reactivar':
            case 'reactivar_servicio':
                await this.handleServiceReactivation(user);
                break;

            case 'sesion':
            case 'session':
                await this.handleSessionInfo(user);
                break;

            case 'extender_sesion':
            case 'extend_session':
                await this.handleExtendSession(user);
                break;

            default:
                // AI-powered response for unrecognized commands
                await this.handleIntelligentResponse(user, message);
                break;
        }
    }

    private async handlePingRequest(user: User): Promise<void> {
        try {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '📡 Verificando tu conexi��n...\n\nEsto puede tomar unos segundos.');

            const customerInfo = await this.customerService.getCustomerInfo(user.customerId!);
            const ipAddress = customerInfo.ip_address;

            if (!ipAddress) {
                throw new Error('IP address not found');
            }

            const pingResult = await this.customerService.pingIP(ipAddress);

            let statusMessage = '';
            if (pingResult.alive) {
                statusMessage = `✅ *Conexión ACTIVA*\n\n` +
                    `🌐 IP: ${ipAddress}\n` +
                    `⏱️ Tiempo: ${pingResult.time}ms\n` +
                    `📊 Estado: Óptimo`;
            } else {
                statusMessage = `❌ *Conexión INACTIVA*\n\n` +
                    `🌐 IP: ${ipAddress}\n` +
                    `⚠️ Tu equipo no responde al ping\n\n` +
                    `💡 *Posibles soluciones:*\n` +
                    `• Reinicia tu router\n` +
                    `• Verifica cables de conexión\n` +
                    `• Contacta soporte si persiste`;

                // Auto-create ticket for connection issues
                await this.createAutoTicket(user, 'Conexión inactiva',
                    `Ping fallido a IP ${ipAddress}`);
            }

            await this.messageService.sendTextMessage(user.phoneNumber, statusMessage);
        } catch (error) {
            console.error('Ping error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al verificar conexión. Intenta nuevamente o contacta soporte.');
        }
    }

    private async handleInvoiceRequest(user: User): Promise<void> {
        try {
            const invoices = await this.customerService.getCustomerInvoices(user.customerId!);

            if (invoices.length === 0) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '📄 No tienes facturas pendientes en este momento.');
                return;
            }

            const latestInvoice = invoices[0];
            const statusEmoji = latestInvoice.status === 'paid' ? '✅' :
                latestInvoice.status === 'overdue' ? '🚨' : '⏳';

            const invoiceMessage = `📄 *Tu Factura Actual*\n\n` +
                `${statusEmoji} Estado: ${this.paymentService.getInvoiceStatusText(latestInvoice.status)}\n` +
                `💰 Valor: $${latestInvoice.amount.toLocaleString()}\n` +
                `📅 Vencimiento: ${moment(latestInvoice.dueDate).format('DD/MM/YYYY')}\n\n`;

            await this.messageService.sendTextMessage(user.phoneNumber, invoiceMessage);

            // Send PDF if available
            if (latestInvoice.pdfUrl) {
                await this.messageService.sendDocument(user.phoneNumber, latestInvoice.pdfUrl, 'Factura_Conecta2.pdf');
            }

            // Send payment options if pending
            if (latestInvoice.status !== 'paid') {
                await this.messageService.sendPaymentOptions(user.phoneNumber);
            }
        } catch (error) {
            console.error('Invoice error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar facturas. Intenta nuevamente.');
        }
    }

    private async handleDebtInquiry(user: User): Promise<void> {
        try {
            const debtInfo = await this.customerService.getCustomerDebt(user.customerId!);

            if (!debtInfo) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Lo siento, no pude obtener la información de tu deuda en este momento.\n\n' +
                    'Por favor, intenta nuevamente más tarde o contacta a nuestro servicio al cliente.');
                return;
            }

            let debtMessage = '';
            if (debtInfo.totalDebt === 0) {
                debtMessage = '✅ *¡Felicitaciones!*\n\n' +
                    '🎉 No tienes deudas pendientes\n' +
                    '📊 Tu cuenta está al día';
            } else {
                debtMessage = `💰 *Resumen de Deuda*\n\n` +
                    `🔴 Total adeudado: $${debtInfo.totalDebt.toLocaleString()}\n` +
                    `📄 Facturas pendientes: ${debtInfo.pendingInvoices}\n` +
                    `📅 Próxima fecha límite: ${moment(debtInfo.nextDueDate).format('DD/MM/YYYY')}\n\n` +
                    `💡 Paga antes del vencimiento para evitar suspensión del servicio.`;
            }

            await this.messageService.sendTextMessage(user.phoneNumber, debtMessage);
        } catch (error) {
            console.error('Error handling debt inquiry:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                'Lo siento, ocurrió un error al consultar tu deuda. Por favor, intenta nuevamente más tarde.');
        }
    } private async handlePasswordChange(user: User): Promise<void> {
        let session = this.userSessions.get(user.phoneNumber);
        if (!session) {
            session = {
                changingPassword: false,
                creatingTicket: false,
                handlingReactivation: false
            };
        }

        if (!session.changingPassword) {
            session.changingPassword = true;
            session.step = 'current_password';
            this.userSessions.set(user.phoneNumber, session);

            await this.messageService.sendTextMessage(user.phoneNumber,
                '🔐 *Cambio de Contraseña*\n\n' +
                'Para tu seguridad, necesito verificar tu identidad.\n\n' +
                'Ingresa tu contraseña actual:');
        }
        // Password change flow continues in intelligent response handler
    } private async handleTicketCreation(user: User): Promise<void> {
        let session = this.userSessions.get(user.phoneNumber);
        if (!session) {
            session = {
                changingPassword: false,
                creatingTicket: false,
                handlingReactivation: false
            };
        }

        try {
            // Verificar si el usuario tiene un servicio activo antes de permitir la creación de tickets
            if (user.encryptedData) {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                if (decryptedData.isInactive) {
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '⚠️ Tu servicio está actualmente inactivo.\n\n' +
                        'Para reactivarlo y poder crear tickets de soporte técnico, primero debes regularizar tu cuenta.\n\n' +
                        'Te recomendamos:\n' +
                        '1️⃣ Verificar el estado de tu facturación\n' +
                        '2️⃣ Realizar el pago pendiente si lo hubiera\n' +
                        '3️⃣ Contactar a nuestro equipo de atención al cliente');
                    return;
                }
            }

            if (!session.creatingTicket) {
                // Obtener información del cliente para personalizar la experiencia
                let clientName = "cliente";
                if (user.encryptedData) {
                    try {
                        const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                        if (decryptedData.customerName) {
                            clientName = decryptedData.customerName.split(' ')[0]; // Usar solo el primer nombre
                        }
                    } catch (error) {
                        console.error('Error decrypting user data:', error);
                    }
                }

                session.creatingTicket = true;
                session.step = 'category';
                session.ticketData = {
                    startTime: new Date(),
                    clientName: clientName
                };
                this.userSessions.set(user.phoneNumber, session);

                const ticketMenu = {
                    messaging_product: 'whatsapp',
                    to: user.phoneNumber,
                    type: 'interactive',
                    interactive: {
                        type: 'list',
                        header: {
                            type: 'text',
                            text: '🎫 Crear Ticket de Soporte'
                        },
                        body: {
                            text: `Hola ${clientName}, vamos a crear un ticket de soporte para solucionar tu problema lo antes posible.\n\nSelecciona el tipo de problema que estás experimentando:`
                        },
                        action: {
                            button: 'Seleccionar',
                            sections: [
                                {
                                    title: 'Problemas Técnicos',
                                    rows: [
                                        {
                                            id: 'internet_lento',
                                            title: '🐌 Internet Lento',
                                            description: 'Velocidad menor a la contratada'
                                        },
                                        {
                                            id: 'sin_internet',
                                            title: '🚫 Sin Internet',
                                            description: 'No hay conexión a internet'
                                        },
                                        {
                                            id: 'intermitente',
                                            title: '📶 Conexión Intermitente',
                                            description: 'Se corta constantemente'
                                        }
                                    ]
                                },
                                {
                                    title: 'Otros',
                                    rows: [
                                        {
                                            id: 'facturacion',
                                            title: '💰 Facturación',
                                            description: 'Problemas con cobros'
                                        },
                                        {
                                            id: 'otro',
                                            title: '❓ Otro',
                                            description: 'Problema diferente'
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                };

                await this.messageService.sendMessage(ticketMenu);
            }
        } catch (error) {
            console.error('Error creating ticket:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error al crear el ticket. Por favor, intenta nuevamente en unos momentos.');
        }
    }

    private async handlePlanUpgrade(user: User): Promise<void> {
        try {
            const currentPlan = await this.customerService.getCustomerPlan(user.customerId!);

            if (!currentPlan) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Lo siento, no pude obtener la información de tu plan actual.\n\n' +
                    'Por favor, intenta nuevamente más tarde o contacta a nuestro servicio al cliente.');
                return;
            }

            // En la nueva versión no tenemos getAvailableUpgrades, así que simulamos planes disponibles
            // En un caso real, esto debería obtenerse de la API
            const availableUpgrades = [
                {
                    id: 'plan-premium',
                    name: 'Plan Premium',
                    speed: `${parseInt(currentPlan.speed) + 10}/5 Mbps`,
                    price: currentPlan.price * 1.2,
                    description: 'Mayor velocidad para toda la familia'
                },
                {
                    id: 'plan-ultra',
                    name: 'Plan Ultra',
                    speed: `${parseInt(currentPlan.speed) + 20}/10 Mbps`,
                    price: currentPlan.price * 1.5,
                    description: 'Máxima velocidad para gaming y streaming'
                }
            ];

            if (availableUpgrades.length === 0) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '⬆️ Ya tienes nuestro plan más avanzado.\n\n' +
                    '🎉 ¡Gracias por confiar en nosotros!');
                return;
            }

            let upgradeMessage = `⬆️ *Mejora tu Plan*\n\n` +
                `📊 Plan actual: ${currentPlan.name}\n` +
                `🚀 Velocidad: ${currentPlan.speed}\n` +
                `💰 Valor: $${currentPlan.price.toLocaleString()}\n\n` +
                `*Planes disponibles para upgrade:*\n\n`;

            availableUpgrades.forEach((plan, index) => {
                upgradeMessage += `${index + 1}. ${plan.name}\n` +
                    `   🚀 Velocidad: ${plan.speed}\n` +
                    `   💰 Valor: $${plan.price.toLocaleString()}\n\n`;
            });

            upgradeMessage += 'Responde con el número del plan que te interesa o escribe "agente" para hablar con nuestro equipo comercial.';

            await this.messageService.sendTextMessage(user.phoneNumber, upgradeMessage);
        } catch (error) {
            console.error('Plan upgrade error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar planes. Contacta a nuestro equipo comercial.');
        }
    }

    private async handlePaymentPoints(user: User): Promise<void> {
        try {
            const paymentPoints = await this.paymentService.getPaymentPoints();

            let pointsMessage = '📍 *Puntos de Pago Autorizados*\n\n';

            paymentPoints.forEach((point: PaymentPoint, index: number) => {
                pointsMessage += `${index + 1}. **${point.name}**\n` +
                    `   📍 ${point.address}\n` +
                    `   ⏰ ${point.hours}\n` +
                    `   📞 ${point.phone}\n\n`;
            });

            pointsMessage += '💡 También puedes pagar en línea a través de nuestro portal web o bancos en línea.';

            await this.messageService.sendTextMessage(user.phoneNumber, pointsMessage);

            // Send location for the nearest point
            if (paymentPoints.length > 0) {
                await this.messageService.sendLocation(user.phoneNumber,
                    paymentPoints[0].latitude,
                    paymentPoints[0].longitude,
                    paymentPoints[0].name,
                    paymentPoints[0].address);
            }
        } catch (error) {
            console.error('Payment points error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar puntos de pago. Intenta nuevamente.');
        }
    }

    private async handleIntelligentResponse(user: User, message: string): Promise<void> {
        try {
            // Check for ongoing sessions first
            const session = this.userSessions.get(user.phoneNumber);

            if (session?.changingPassword) {
                await this.handlePasswordChangeFlow(user, message, session);
                return;
            }

            if (session?.creatingTicket) {
                await this.handleTicketFlow(user, message, session);
                return;
            }

            // Check if human assistance is needed
            const needsHuman = await this.customerService.needsHumanAssistance(message);
            if (needsHuman) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '🤝 Un agente de servicio al cliente se pondrá en contacto contigo pronto.\n\n' +
                    '⏰ Tiempo estimado de respuesta: 15-30 minutos\n' +
                    '📱 Te notificaremos por WhatsApp cuando el agente esté disponible.');

                // Crear un ticket automático para atención humana
                await this.createAutoTicket(
                    user,
                    'Solicitud de Atención Personalizada',
                    `El cliente solicitó atención humana con el mensaje: "${message}"`
                );
                return;
            }

            // AI-powered response for general queries
            const aiResponse = await this.aiService.getAIResponse(message, user);
            await this.messageService.sendTextMessage(user.phoneNumber, aiResponse);

        } catch (error) {
            console.error('Intelligent response error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                'No entendí tu solicitud. Escribe "menu" para ver las opciones disponibles o "agente" para hablar con una persona.');
        }
    }

    private async handlePasswordChangeFlow(user: User, message: string, session: SessionData): Promise<void> {
        try {
            switch (session.step) {
                case 'current_password': {
                    // Verify current password with WispHub
                    const isValidCurrentPassword = await this.customerService.verifyPassword(user.customerId!, message);

                    if (isValidCurrentPassword) {
                        session.step = 'new_password';
                        this.userSessions.set(user.phoneNumber, session);

                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '✅ Contraseña actual verificada.\n\n' +
                            '🔐 Ahora ingresa tu nueva contraseña:\n\n' +
                            '📋 Requisitos:\n' +
                            '• Mínimo 8 caracteres\n' +
                            '• Al menos 1 número\n' +
                            '• Al menos 1 letra mayúscula\n' +
                            '• Al menos 1 carácter especial (!@#$%^&*)');
                    } else {
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '❌ Contraseña incorrecta. Intenta nuevamente:');
                    }
                    break;
                }

                case 'new_password':
                    if (isValidPassword(message)) {
                        session.step = 'confirm_password';
                        session.newPassword = message;
                        this.userSessions.set(user.phoneNumber, session);

                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '🔄 Confirma tu nueva contraseña:');
                    } else {
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '❌ La contraseña no cumple los requisitos. Intenta nuevamente:\n\n' +
                            '📋 Debe tener:\n' +
                            '• Mínimo 8 caracteres\n' +
                            '• Al menos 1 número\n' +
                            '• Al menos 1 letra mayúscula\n' +
                            '• Al menos 1 carácter especial');
                    }
                    break;

                case 'confirm_password': {
                    if (message === session.newPassword) {
                        // Update password in WispHub
                        const success = await this.customerService.updatePassword(user.customerId!, session.newPassword);

                        if (success) {
                            // Clear session
                            this.userSessions.delete(user.phoneNumber);

                            await this.messageService.sendTextMessage(user.phoneNumber,
                                '✅ ¡Contraseña actualizada exitosamente!\n\n' +
                                '🔐 Tu nueva contraseña ya está activa.\n' +
                                'Úsala para acceder a tu portal web y configurar tu router.');
                        } else {
                            throw new Error('Password update failed');
                        }
                    } else {
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '❌ Las contraseñas no coinciden. Confirma nuevamente:');
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Password change flow error:', error);
            this.userSessions.delete(user.phoneNumber);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al cambiar contraseña. Intenta nuevamente más tarde o contacta soporte.');
        }
    }

    private async handleTicketFlow(user: User, message: string, session: SessionData): Promise<void> {
        try {
            switch (session.step) {
                case 'category':
                    session.category = message;
                    session.step = 'description';
                    this.userSessions.set(user.phoneNumber, session);

                    await this.messageService.sendTextMessage(user.phoneNumber,
                        `📝 Perfecto, seleccionaste: ${this.ticketService.getCategoryName(message)}\n\n` +
                        'Ahora describe detalladamente tu problema:\n\n' +
                        '💡 Incluye:\n' +
                        '• ¿Cuándo comenzó?\n' +
                        '• ¿Con qué frecuencia ocurre?\n' +
                        '• ¿Qué intentaste hacer?\n' +
                        '• Cualquier mensaje de error');
                    break;

                case 'description': {
                    session.description = message;

                    // Create ticket
                    const ticketData = {
                        customerId: user.customerId!,
                        category: session.category,
                        description: session.description,
                        priority: 'media' as const
                    };

                    const ticketId = await this.ticketService.createTicket(ticketData);

                    // Notificar la creación del ticket
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '✅ *Ticket Creado Exitosamente*\n\n' +
                        `🔍 Ticket ID: ${ticketId}\n` +
                        `📋 Categoría: ${this.ticketService.getCategoryName(session.category || 'general')}\n` +
                        `📝 Descripción: ${session.description}\n\n` +
                        '👉 *Próximos Pasos:*\n' +
                        '• Tu ticket será revisado por nuestro equipo\n' +
                        '• Te notificaremos cuando haya actualizaciones\n' +
                        '• Puedes consultar el estado con el comando /ticket\n\n' +
                        '¡Gracias por tu paciencia! 🙏');

                    // Notificar internamente del nuevo ticket
                    await this.ticketService.notifyNewTicket(ticketId, user.customerId!);

                    // Limpiar datos de sesión
                    session.creatingTicket = false;
                    session.category = undefined;
                    session.description = undefined;
                    session.step = undefined;
                    this.userSessions.set(user.phoneNumber, session);
                    break;
                }
            }
        } catch (error) {
            console.error('Error handling ticket flow:', error);
            await this.messageService.sendErrorMessage(user.phoneNumber,
                'No se pudo procesar tu solicitud de ticket. Por favor, intenta nuevamente.');

            // Reset session state on error
            session.creatingTicket = false;
            session.category = undefined;
            session.description = undefined;
            session.step = undefined;
            this.userSessions.set(user.phoneNumber, session);
        }
    } private async createAutoTicket(user: User, subject: string, description: string): Promise<void> {
        try {
            const ticketData = {
                customerId: user.customerId!,
                category: 'general',
                description: description,
                priority: 'media' as const
            };

            const ticketId = await this.ticketService.createTicket(ticketData);
            console.log(`Auto-ticket created: ${ticketId} for user ${user.phoneNumber}`);
        } catch (error) {
            console.error('Auto-ticket creation error:', error);
        }
    }

    private async handleSessionInfo(user: User): Promise<void> {
        try {
            const sessionCheck = this.securityService.validateSession(user.phoneNumber);

            if (!sessionCheck.valid) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ No tienes una sesión activa.');
                return;
            }

            const sessionHours = Math.floor(sessionCheck.remainingTime! / 60);
            const sessionMinutes = sessionCheck.remainingTime! % 60;

            let timeDisplay = '';
            if (sessionHours > 0) {
                timeDisplay = `${sessionHours} hora(s) y ${sessionMinutes} minuto(s)`;
            } else {
                timeDisplay = `${sessionMinutes} minuto(s)`;
            }

            // Decrypt customer data for display
            let customerName = 'Usuario';
            if (user.encryptedData) {
                try {
                    const decryptedData = this.securityService.decryptSensitiveData(user.encryptedData);
                    const customerData = JSON.parse(decryptedData);
                    customerName = customerData.customerName;
                } catch (error) {
                    console.error('Error decrypting customer data:', error);
                }
            }

            await this.messageService.sendTextMessage(user.phoneNumber,
                `🔒 *Información de Sesión*\n\n` +
                `👤 Usuario: ${customerName}\n` +
                `📱 Teléfono: ${user.phoneNumber}\n` +
                `⏰ Tiempo restante: ${timeDisplay}\n` +
                `🔐 Sesión ID: ${user.sessionId?.substring(0, 8)}...\n` +
                `📅 Última actividad: ${user.lastActivity ? moment(user.lastActivity).format('DD/MM/YYYY HH:mm') : 'N/A'}\n\n` +
                `💡 Tu sesión se extiende automáticamente con cada mensaje.\n` +
                `Escribe "extender_sesion" para renovar manualmente.`);
        } catch (error) {
            console.error('Session info error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar información de sesión.');
        }
    }

    private async handleExtendSession(user: User): Promise<void> {
        try {
            const extended = this.securityService.extendSession(user.phoneNumber);

            if (extended) {
                // Update user session data
                user.sessionExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
                user.lastActivity = new Date();
                this.users.set(user.phoneNumber, user);

                await this.messageService.sendTextMessage(user.phoneNumber,
                    '✅ *Sesión Extendida*\n\n' +
                    '⏰ Tu sesión ha sido renovada por 2 horas adicionales.\n\n' +
                    '🔒 Continuarás autenticado de forma segura.\n\n' +
                    'Escribe "sesion" para ver los detalles actualizados.');
            } else {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ No se pudo extender la sesión.\n\n' +
                    'Es posible que tu sesión haya expirado. Por favor, autentica nuevamente.');
            }
        } catch (error) {
            console.error('Extend session error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al extender sesión. Intenta nuevamente.');
        }
    }

    private async handleHumanAssistanceRequest(user: User, message: string): Promise<void> {
        try {
            let customerInfo = "";

            // Agregar información del cliente si está autenticado
            if (user.authenticated && user.customerId) {
                const customerData = await this.customerService.getCustomerInfo(user.customerId);
                customerInfo = `\nCliente: ${customerData.name}\nID: ${customerData.id}\nEmail: ${customerData.email || 'No registrado'}`;
            } else {
                customerInfo = "\nCliente no autenticado";
            }

            // Crear ticket para seguimiento
            const ticketDescription = `Solicitud de atención personalizada${customerInfo}\nMensaje original: "${message}"`;

            await this.createAutoTicket(
                user,
                'Solicitud de Atención Personalizada',
                ticketDescription
            );

            // Enviar mensaje al usuario
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🤝 Un agente de servicio al cliente se pondrá en contacto contigo pronto.\n\n' +
                '⏰ Tiempo estimado de respuesta: 15-30 minutos\n' +
                '📱 Te notificaremos por WhatsApp cuando el agente esté disponible.' +
                (user.authenticated ? '' : '\n\n💡 Tip: Para una atención más rápida, puedes autenticarte con tu número de documento.'));

        } catch (error) {
            console.error('Human assistance request error:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta nuevamente en unos minutos.');
        }
    }    /**
     * Registra todos los flujos de conversación disponibles
     */
    private registerConversationFlows(): void {
        // Registrar el flujo de selección inicial (debe ser primero)
        this.flowManager.registerFlow(
            new InitialSelectionFlow(this.messageService, this.securityService)
        );

        // Registrar el flujo de política de privacidad
        this.flowManager.registerFlow(
            new PrivacyPolicyFlow(this.messageService, this.securityService)
        );

        // Registrar el flujo de autenticación
        this.flowManager.registerFlow(
            new AuthenticationFlow(this.messageService, this.securityService, this.customerService)
        );

        // Registrar el flujo de ventas
        this.flowManager.registerFlow(
            new SalesFlow(this.messageService, this.securityService, this.aiService, this.customerService)
        );

        // Registrar el flujo de soporte técnico
        this.flowManager.registerFlow(
            new TechnicalSupportFlow(this.messageService, this.securityService, this.customerService)
        );        // Registrar el flujo de facturas
        this.flowManager.registerFlow(
            new InvoicesFlow(this.messageService, this.securityService, this.customerService)
        );        // Registrar los nuevos flujos técnicos especializados
        this.flowManager.registerFlow(
            new TicketCreationFlow(this.messageService, this.securityService, this.ticketService)
        );

        this.flowManager.registerFlow(
            new PasswordChangeFlow(this.messageService, this.securityService, this.ticketService)
        );

        this.flowManager.registerFlow(
            new GeneralSupportFlow(this.messageService, this.securityService, this.aiService, this.customerService)
        ); this.flowManager.registerFlow(
            new PaymentVerificationFlow(this.messageService, this.securityService, this.paymentService, this.aiService)
        ); this.flowManager.registerFlow(
            new PlanUpgradeFlow(this.messageService, this.securityService, this.customerService)
        );

        this.flowManager.registerFlow(
            new AdvisorTransferFlow(this.messageService, this.aiService, this.customerService)
        );

        this.flowManager.registerFlow(
            new IPDiagnosticFlow(this.messageService, this.aiService, this.customerService)
        );

        this.flowManager.registerFlow(
            new PaymentPointsFlow(this.messageService, this.aiService, this.customerService)
        );

        // Registrar el flujo de tickets
        this.flowManager.registerFlow(
            new TicketFlow(this.messageService, this.securityService, this.ticketService)
        );

        // Registrar el flujo de reactivación de servicio
        this.flowManager.registerFlow(
            new ServiceReactivationFlow(
                this.messageService,
                this.securityService,
                this.customerService,
                this.paymentService
            )
        );

        // Registrar el flujo de menú principal (debe ser el último para que funcione como fallback)
        this.flowManager.registerFlow(
            new MainMenuFlow(this.messageService, this.securityService)
        );
    }
    private async handleServiceReactivation(user: User): Promise<void> {
        try {
            // Intentar procesar a través del flujo de reactivación
            const session = this.userSessions.get(user.phoneNumber) || {
                changingPassword: false,
                creatingTicket: false,
                handlingReactivation: false
            };

            session.handlingReactivation = true;
            this.userSessions.set(user.phoneNumber, session);

            await this.messageService.sendTextMessage(user.phoneNumber,
                '🔄 *Reactivación de Servicio*\n\n' +
                'Te ayudaré con la reactivación de tu servicio.\n\n' +
                'Verificando tu estado de cuenta...');

            // El flujo específico manejará el resto
            await this.flowManager.processMessage(user, 'reactivar_servicio', session);

        } catch (error) {
            console.error('Error handling service reactivation:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al procesar la reactivación. Por favor, contacta atención al cliente.');
        }
    }
}
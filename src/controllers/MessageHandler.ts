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
    PrivacyPolicyFlow, InitialSelectionFlow, ClientMenuFlow,
    SalesFlow,
    InvoicesFlow,
    TicketCreationFlow,
    PasswordChangeFlow,
    PlanUpgradeFlow,
    IPDiagnosticFlow,
    PaymentPointsFlow,
    PaymentReceiptFlow,
    DebtInquiryFlow,
    LogoutFlow,
    AgentHandoverFlow,
    SuspendedServiceFlow
} from '../flows';
import { isValidPassword } from '../utils';
import { extractMenuCommand } from '../utils/messageUtils';

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
        this.securityService = new SecurityService();        // Inicializar el gestor de sesiones
        this.sessionManager = new SessionManager(this.messageService);

        // Inicializar el gestor de flujos con el servicio de mensajes
        this.flowManager = new ConversationFlowManager(this.messageService);

        // Registrar los flujos de conversación
        this.registerConversationFlows();

        // Configurar limpieza periódica de sesiones expiradas
        setInterval(() => {
            this.sessionManager.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Cada 5 minutos
    } async processMessage(message: WhatsAppMessage): Promise<void> {
        const phoneNumber = message.from;

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

        // Get or create user
        let user = this.users.get(phoneNumber);
        if (!user) {
            user = {
                phoneNumber,
                authenticated: false,
                acceptedPrivacyPolicy: false
            };
            this.users.set(phoneNumber, user);
        }        // Extract text from message based on type
        let messageText = '';
        if (message.type === 'text' && message.text) {
            messageText = message.text.body;

            // Verificar si es un mensaje de validación de pago en formato especial
            if (messageText.includes('💳 Validar Pago') &&
                (messageText.includes('Subir comprobante de pago') ||
                    messageText.includes('subir comprobante'))) {
                console.log(`Detectado mensaje de texto con formato de validación de pago: "${messageText}"`);
                // Normalizar para garantizar que se reconozca correctamente
                messageText = 'validar_pago';
            }
        } else if (message.type === 'interactive') {
            if (message.interactive?.button_reply) {
                // Guardar el mensaje completo, incluido el título
                messageText = message.interactive.button_reply.title;
                const buttonId = message.interactive.button_reply.id;
                console.log(`Botón seleccionado: ${messageText}, ID: ${buttonId}`);

                // Para botones relacionados con pagos, priorizar el ID
                if (buttonId && (buttonId === 'validar_pago' || buttonId.includes('pago') || buttonId.includes('comprobante'))) {
                    console.log(`Detectado botón de validación de pago con ID: ${buttonId}`);
                    messageText = 'validar_pago';
                }
            } else if (message.interactive?.list_reply) {                // Capturar el ID explícitamente - esto es crucial para la correcta redirección
                const listId = message.interactive.list_reply.id;
                console.log(`Lista seleccionada - ID: ${listId}, Título: ${message.interactive.list_reply.title}`);

                // Para opciones relacionadas con pagos, priorizar el ID
                if (listId === 'validar_pago' ||
                    listId === 'comprobante_pago' ||
                    listId.includes('pago') ||
                    listId.includes('comprobante')) {
                    console.log(`Detectada selección de validación de pago con ID: ${listId}`);
                    messageText = 'validar_pago';
                } else {
                    // Para otros casos, usar el título como respaldo
                    messageText = message.interactive.list_reply.title;
                    // Opcionalmente agregar la descripción
                    if (message.interactive.list_reply.description) {
                        messageText += '\n' + message.interactive.list_reply.description;
                    }
                }
            }
        }

        // Process message based on user state
        // For images and other media, pass the full WhatsApp message object
        if (message.type === 'image' || message.type === 'document' || message.type === 'audio' || message.type === 'video') {
            await this.handleUserMessage(user, message);
        } else {
            await this.handleUserMessage(user, messageText);
        }
    } private async handleUserMessage(user: User, message: string | WhatsAppMessage): Promise<void> {
        try {
            // Obtener o crear una sesión para este usuario
            let session = this.userSessions.get(user.phoneNumber);
            if (!session) {
                session = {
                    changingPassword: false,
                    creatingTicket: false
                };
                this.userSessions.set(user.phoneNumber, session);
            }

            // Si el usuario está autenticado, validar sesión activa
            if (user.authenticated) {
                const sessionValidation = this.securityService.validateSession(user.phoneNumber);
                if (!sessionValidation.valid) {
                    // Sesión expirada, limpiar autenticación
                    user.authenticated = false;
                    user.sessionId = undefined;
                    user.sessionExpiresAt = undefined;
                    this.users.set(user.phoneNumber, user);
                }
            }

            // Actualizar última actividad
            user.lastActivity = new Date();
            this.users.set(user.phoneNumber, user);

            // Delegar TODA la lógica al gestor de flujos
            const handled = await this.flowManager.processMessage(user, message, session);

            // Si ningún flujo manejó el mensaje, mostrar mensaje de ayuda simple
            if (!handled) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❓ No pude entender tu mensaje.\n\n' +
                    'Escribe "menu" para ver las opciones disponibles o "ayuda" para contactar a un agente.');
            }

            // Guardar el estado actualizado
            this.users.set(user.phoneNumber, user);
            this.userSessions.set(user.phoneNumber, session);
        } catch (error) {
            console.error('Error handling user message:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                'Ha ocurrido un error técnico. Por favor, intenta nuevamente en unos minutos.');
        }
    }/**
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
        );        // Registrar el flujo de autenticación
        this.flowManager.registerFlow(
            new AuthenticationFlow(this.messageService, this.securityService, this.customerService)
        );

        // Registrar el flujo de menú de cliente (para navegación post-autenticación)
        this.flowManager.registerFlow(
            new ClientMenuFlow(this.messageService, this.securityService)
        );

        // Registrar el flujo de creación de tickets (alta prioridad)
        this.flowManager.registerFlow(
            new TicketCreationFlow(this.messageService, this.securityService, this.ticketService)
        );

        // Registrar el flujo de mejora de plan (antes del SalesFlow para mayor prioridad)
        this.flowManager.registerFlow(
            new PlanUpgradeFlow(this.messageService, this.securityService, this.customerService, this.ticketService)
        );

        // Registrar el flujo de ventas
        this.flowManager.registerFlow(
            new SalesFlow(this.messageService, this.securityService, this.aiService, this.customerService));        // Registrar el flujo de facturas
        this.flowManager.registerFlow(
            new InvoicesFlow(this.messageService, this.securityService, this.customerService)
        );

        // Registrar el flujo de consulta de deuda
        this.flowManager.registerFlow(
            new DebtInquiryFlow(this.messageService, this.securityService, this.customerService)
        );

        // Registrar el flujo de cambio de contraseña
        this.flowManager.registerFlow(
            new PasswordChangeFlow(this.messageService, this.securityService, this.ticketService)
        );// Registrar el flujo de puntos de pago
        this.flowManager.registerFlow(
            new PaymentPointsFlow(this.messageService)
        );        // Registrar el flujo de diagnóstico IP
        this.flowManager.registerFlow(
            new IPDiagnosticFlow(this.messageService, this.securityService, this.customerService)
        );

        // Registrar el flujo de comprobantes de pago
        this.flowManager.registerFlow(
            new PaymentReceiptFlow()
        );        // Registrar el flujo de cierre de sesión
        this.flowManager.registerFlow(
            new LogoutFlow(this.messageService, this.securityService)
        );

        // Registrar el flujo de handover a agente humano
        this.flowManager.registerFlow(
            new AgentHandoverFlow(this.messageService, this.securityService, this.ticketService)
        );

        // Registrar el flujo para servicios suspendidos
        this.flowManager.registerFlow(
            new SuspendedServiceFlow(this.messageService, this.securityService)
        );
    }
}
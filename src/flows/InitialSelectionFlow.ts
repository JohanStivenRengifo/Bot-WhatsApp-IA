import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';
import { extractMenuCommand, isMenuCommand, detectsConfusion, detectsRuralUser } from '../utils/messageUtils';

/**
 * Flujo inicial para seleccionar entre Ventas y acceso como Cliente
 */
export class InitialSelectionFlow extends BaseConversationFlow {
    readonly name: string = 'initialSelection';

    constructor(
        messageService: MessageService,
        securityService: SecurityService
    ) {
        super(messageService, securityService);
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario no está autenticado y no tiene un flujo activo
        // 2. Es el primer mensaje del usuario
        // 3. El usuario responde con ventas o soporte a la selección inicial
        // 4. El usuario escribe "menu" sin estar autenticado
        const isInitialMessage = !user.authenticated && !session.flowActive && !user.hasSelectedService;

        const isMenuRequest = message.toLowerCase().trim() === 'menu' && !user.authenticated;

        const isSelectionResponse = session.flowActive === 'initialSelection' &&
            (message.toLowerCase().includes('ventas') ||
                message.toLowerCase().includes('soporte') ||
                message.toLowerCase().includes('ya soy cliente') ||
                message === 'ventas' || message === 'soporte' ||
                message === 'Ya soy cliente');

        return isInitialMessage || isSelectionResponse || isMenuRequest;
    }/**
     * Maneja el proceso de selección inicial
     */    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Si es una respuesta a la selección (ventas o soporte)
            if (session.flowActive === 'initialSelection') {
                return await this.handleSelection(user, message, session);
            }

            // Si es una solicitud de menú sin estar autenticado, mostrar opciones iniciales
            if (message.toLowerCase().trim() === 'menu' && !user.authenticated) {
                return await this.showInitialOptions(user, session);
            }

            // Si es el primer mensaje, mostrar opciones
            return await this.showInitialOptions(user, session);
        } catch (error) {
            console.error('Error en flujo de selección inicial:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Por favor, intenta nuevamente.');
            return true;
        }
    }    /**
     * Muestra las opciones iniciales al usuario
     */
    private async showInitialOptions(user: User, session: SessionData): Promise<boolean> {
        // Detectar si debe usar UX simplificada
        const shouldUseSimplified = this.shouldUseSimplifiedUX(user, session);

        if (shouldUseSimplified) {
            // Usar mensaje más simple y directo
            await this.messageService.sendTextMessage(user.phoneNumber,
                '👋 **¡Hola! Soy de Conecta2 Telecomunicaciones**\n\n' +
                '¿Qué necesitas?\n\n' +
                '🛒 **ventas** - Para servicios nuevos\n' +
                '🔧 **soporte** - Si ya eres cliente\n\n' +
                'Solo escribe "ventas" o "soporte"');

            session.simplifiedUXPreferred = true;
            session.flowActive = 'initialSelection';
            return true;
        }

        // Enviar mensaje de bienvenida con opciones
        const welcomeMessage = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '🌟 ¡Bienvenido a Conecta2 Telecomunicaciones!'
                },
                body: {
                    text: '¡Hola! Soy tu asistente virtual de Conecta2 Telecomunicaciones. ¿En qué puedo ayudarte hoy? 😊\n\nSelecciona una opción:'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'ventas',
                                title: '🛒 Ventas'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'soporte',
                                title: '🔧 Ya soy cliente'
                            }
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(welcomeMessage);

        // Marcar que el usuario está en el proceso de selección inicial
        session.flowActive = 'initialSelection';
        return true;
    }

    /**
     * Maneja la respuesta del usuario a la selección inicial
     */
    private async handleSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        const messageText = message.toLowerCase(); if (messageText.includes('ventas') || message === 'ventas') {
            // Usuario seleccionó ventas
            session.selectedService = 'ventas';
            session.flowActive = 'sales';
            user.hasSelectedService = true;

            // Mostrar política de privacidad para ventas
            await this.messageService.sendPrivacyPolicyMessage(user.phoneNumber);
            return true;
        }
        else if (messageText.includes('soporte') || messageText.includes('ya soy cliente') ||
            message === 'soporte' || message === 'Ya soy cliente') {
            // Usuario seleccionó acceder como cliente
            session.selectedService = 'soporte';
            session.flowActive = 'support';
            user.hasSelectedService = true;

            // Mostrar política de privacidad para soporte
            await this.messageService.sendPrivacyPolicyMessage(user.phoneNumber);
            return true;
            return true;
        }
        else {
            // Detectar confusión o patrones de usuario rural
            if (detectsConfusion(message) || detectsRuralUser(message)) {
                session.confusionCount = (session.confusionCount || 0) + 1;
                session.simplifiedUXPreferred = true;

                await this.messageService.sendTextMessage(user.phoneNumber,
                    '👋 Entiendo que puedes necesitar ayuda.\n\n' +
                    'Es muy fácil:\n\n' +
                    '🛒 Escribe "ventas" si quieres servicios nuevos\n' +
                    '🔧 Escribe "soporte" si ya eres cliente\n\n' +
                    'Solo una palabra: "ventas" o "soporte"');
            } else {
                // Respuesta no válida normal
                session.incorrectCommandCount = (session.incorrectCommandCount || 0) + 1;

                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Por favor, selecciona una opción válida:\n\n' +
                    '🛒 Escribe "Ventas" para servicios de venta\n' +
                    '🔧 Escribe "Soporte" para acceder como cliente');
            }
            return true;
        }
    }

    /**
     * Determina si debe usar UX simplificada para este usuario
     */
    private shouldUseSimplifiedUX(user: User, session: SessionData): boolean {
        // Ya está marcado para UX simplificada
        if (session.simplifiedUXPreferred) {
            return true;
        }

        // Si el usuario muestra patrones de confusión
        if ((session.confusionCount || 0) >= 1) {
            return true;
        }

        // Si es la primera interacción y no hay historial de autenticación exitosa
        if (!user.lastSuccessfulAuth && !user.authenticated) {
            return true;
        }

        return false;
    }
}

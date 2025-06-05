import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';

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
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario no está autenticado y no tiene un flujo activo
        // 2. Es el primer mensaje del usuario
        // 3. El usuario responde con ventas o soporte a la selección inicial
        const isInitialMessage = !user.authenticated && !session.flowActive && !user.hasSelectedService;
        const isSelectionResponse = session.flowActive === 'initialSelection' &&
            (message.toLowerCase().includes('ventas') ||
                message.toLowerCase().includes('soporte') ||
                message === 'ventas' || message === 'soporte');

        return isInitialMessage || isSelectionResponse;
    }    /**
     * Maneja el proceso de selección inicial
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Si es una respuesta a la selección (ventas o soporte)
            if (session.flowActive === 'initialSelection') {
                return await this.handleSelection(user, message, session);
            }

            // Si es el primer mensaje, mostrar opciones
            return await this.showInitialOptions(user, session);
        } catch (error) {
            console.error('Error en flujo de selección inicial:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Por favor, intenta nuevamente.');
            return true;
        }
    }

    /**
     * Muestra las opciones iniciales al usuario
     */
    private async showInitialOptions(user: User, session: SessionData): Promise<boolean> {
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
                        }, {
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
        const messageText = message.toLowerCase();

        if (messageText.includes('ventas') || message === 'ventas') {
            // Usuario seleccionó ventas
            session.selectedService = 'ventas';
            session.flowActive = 'sales';
            user.hasSelectedService = true;

            // Mostrar política de privacidad para ventas
            await this.messageService.sendPrivacyPolicyMessage(user.phoneNumber);
            return true;
        }
        else if (messageText.includes('soporte') || message === 'soporte') {
            // Usuario seleccionó acceder como cliente
            session.selectedService = 'soporte';
            session.flowActive = 'support';
            user.hasSelectedService = true;

            // Mostrar política de privacidad para soporte
            await this.messageService.sendPrivacyPolicyMessage(user.phoneNumber);
            return true;
        }
        else {
            // Respuesta no válida, mostrar opciones nuevamente            await this.messageService.sendTextMessage(user.phoneNumber,
            '❌ Por favor, selecciona una opción válida:\n\n' +
                '🛒 Escribe "Ventas" para servicios de venta\n' +
                '🔧 Escribe "Soporte" para acceder como cliente';
            return true;
        }
    }
}

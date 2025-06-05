import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';

/**
 * Flujo para la aceptación de la política de privacidad
 */
export class PrivacyPolicyFlow extends BaseConversationFlow {
    readonly name: string = 'privacyPolicy';

    constructor(messageService: MessageService, securityService: SecurityService) {
        super(messageService, securityService);
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario no ha aceptado la política de privacidad
        // 2. Y ha seleccionado una opción de servicio (ventas o soporte)
        const hasSelectedService = Boolean(session.selectedService) ||
            message.toLowerCase().includes('ventas') ||
            message.toLowerCase().includes('soporte');

        return !user.acceptedPrivacyPolicy && hasSelectedService;
    }    /**
     * Maneja el proceso de aceptación de la política de privacidad
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Verificar si el usuario acepta la política
        if (message.toLowerCase().includes('acepto') || message === 'accept_privacy') {
            await this.handleAcceptPrivacy(user, session);
            return true;
        }
        // Verificar si el usuario rechaza la política
        else if (message.toLowerCase().includes('no acepto') || message === 'reject_privacy') {
            await this.handleRejectPrivacy(user);
            return true;
        }
        // Si el mensaje no es una respuesta clara, mostrar la política nuevamente
        else {
            await this.messageService.sendPrivacyPolicyMessage(user.phoneNumber);
            return true;
        }
    }

    /**
     * Maneja la aceptación de la política de privacidad
     */
    private async handleAcceptPrivacy(user: User, session: SessionData): Promise<void> {
        user.acceptedPrivacyPolicy = true;        // Solo pedir autenticación si el usuario seleccionó soporte técnico
        if (session.selectedService === 'soporte') {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ Gracias por aceptar nuestras políticas.\n\n' +
                'Ahora necesito autenticarte para brindarte soporte personalizado.\n\n' +
                'Puedes ingresar:\n' +
                '• Tu número de cédula/documento de identidad\n' +
                '• Tu ID de servicio (número de cliente)\n\n' +
                'Por favor, ingresa solo los números (sin espacios ni guiones):');

            // Establecer que está esperando un documento
            user.awaitingDocument = true;
        } else {
            // Si seleccionó ventas, confirmar y activar automáticamente la IA de ventas
            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ Gracias por aceptar nuestras políticas.\n\n' +
                '🛒 ¡Perfecto! Te conectaré con nuestro departamento de ventas...');

            // Activar el flujo de ventas automáticamente
            session.flowActive = 'sales';
            session.salesConversationStarted = true;

            // Enviar mensaje inicial del flujo de ventas
            await this.messageService.sendTextMessage(user.phoneNumber, '¿En qué producto o servicio estás interesado? Nuestro equipo de ventas está listo para ayudarte.');
        }
    }

    /**
     * Maneja el rechazo de la política de privacidad
     */
    private async handleRejectPrivacy(user: User): Promise<void> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🙏 Gracias por tu tiempo.\n\n' +
            'Respetamos tu decisión de no autorizar el tratamiento de tus datos personales.\n\n' +
            'Sin esta autorización no podemos brindarte nuestros servicios de soporte personalizado a través de este canal.\n\n' +
            'Si cambias de opinión en el futuro, puedes contactarnos nuevamente.\n\n' +
            '¡Que tengas un excelente día! 😊');
    }
}

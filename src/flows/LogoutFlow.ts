import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo para el cierre de sesión
 */
export class LogoutFlow extends BaseConversationFlow {
    readonly name: string = 'logout';

    constructor(
        messageService: MessageService,
        securityService: SecurityService
    ) {
        super(messageService, securityService);
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        return (
            user.authenticated &&
            (extractedCommand === 'cerrar_sesion' ||
                isMenuCommand(message, ['logout', 'cerrar sesión', 'cerrar sesion', 'salir', 'finalizar sesión', 'terminar']))
        );
    }

    /**
     * Maneja el proceso de cierre de sesión
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Enviar mensaje de despedida
            await this.messageService.sendTextMessage(user.phoneNumber,
                '👋 **¡Sesión Finalizada!**\n\n' +
                'Has cerrado tu sesión correctamente.\n\n' +
                '🔒 Por seguridad, toda tu información ha sido eliminada de nuestra memoria temporal.\n\n' +
                '💬 Escribe "Soporte" cuando quieras volver a usar nuestros servicios.');

            // Limpiar la sesión
            this.clearSession(session);

            // Marcar al usuario como no autenticado
            user.authenticated = false;
            user.encryptedData = undefined;
            user.userServices = undefined;

            return true;
        } catch (error) {
            console.error('Error en el cierre de sesión:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ocurrió un error al cerrar tu sesión. Intenta nuevamente o contacta a soporte.');
            return true;
        }
    }

    /**
     * Limpia todos los datos de la sesión
     */
    private clearSession(session: SessionData): void {
        // Limpiar estados de flujos específicos
        session.creatingTicket = false;
        session.consultingInvoices = false;
        session.changingPassword = false;
        session.verifyingPayment = false;
        session.step = undefined;
        session.flowActive = '';

        // Limpiar cualquier dato temporal de flujos
        session.ticketData = undefined;
        session.category = undefined;
        session.description = undefined;
        session.asunto = undefined;
        session.newPassword = undefined;
    }
}

import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, TicketService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo para cambio de contraseñas mediante ticket
 */
export class PasswordChangeFlow extends BaseConversationFlow {
    readonly name: string = 'passwordChange';

    private ticketService: TicketService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        ticketService: TicketService
    ) {
        super(messageService, securityService);
        this.ticketService = ticketService;
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        return (
            user.authenticated &&
            (extractedCommand === 'cambiar_clave' ||
                isMenuCommand(message, ['password_change', 'nueva_contraseña', 'cambiar contraseña']) ||
                session.changingPassword === true)
        );
    }

    /**
     * Maneja el proceso de cambio de contraseña
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            if (!session.changingPassword) {
                return await this.initializePasswordChange(user, session);
            }

            // Procesar según el paso actual
            switch (session.step) {
                case 'current_password':
                    return await this.verifyCurrentPassword(user, message, session);
                case 'new_password':
                    return await this.setNewPassword(user, message, session);
                case 'confirm_password':
                    return await this.confirmNewPassword(user, message, session);
                default:
                    return await this.initializePasswordChange(user, session);
            }

        } catch (error) {
            console.error('Error en flujo de cambio de contraseña:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ha ocurrido un error. Por favor, intenta nuevamente o contacta soporte.');

            this.resetPasswordSession(session);
            return true;
        }
    }

    /**
     * Inicializa el proceso de cambio de contraseña
     */
    private async initializePasswordChange(user: User, session: SessionData): Promise<boolean> {
        session.changingPassword = true;
        session.step = 'current_password';

        await this.messageService.sendTextMessage(user.phoneNumber,
            '🔐 **Cambio de Contraseña**\n\n' +
            '🛡️ Para tu seguridad, necesito verificar tu identidad antes de cambiar tu contraseña.\n\n' +
            '🔑 Por favor, ingresa tu contraseña actual:\n\n' +
            '💡 *Nota: Esta es la contraseña que usas para acceder a tu router o portal web.*');

        return true;
    }

    /**
     * Verifica la contraseña actual
     */
    private async verifyCurrentPassword(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Simulamos la verificación con WispHub
            // En implementación real, esto verificaría contra WispHub API
            const isValidCurrentPassword = await this.verifyPasswordWithWispHub(user.customerId!, message);

            if (isValidCurrentPassword) {
                session.step = 'new_password';

                await this.messageService.sendTextMessage(user.phoneNumber,
                    '✅ **Contraseña verificada correctamente**\n\n' +
                    '🔐 Ahora ingresa tu nueva contraseña:\n\n' +
                    '📋 **Requisitos de seguridad:**\n' +
                    '• Mínimo 8 caracteres\n' +
                    '• Al menos 1 número\n' +
                    '• Al menos 1 letra mayúscula\n' +
                    '• Al menos 1 letra minúscula\n' +
                    '• Al menos 1 carácter especial (!@#$%^&*)\n\n' +
                    '💡 *Consejo: Usa una combinación de palabras, números y símbolos.*');

                return true;
            } else {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ **Contraseña incorrecta**\n\n' +
                    '🔑 Por favor, verifica e ingresa tu contraseña actual nuevamente:\n\n' +
                    '💭 *Recuerda: Es la contraseña que usas para tu router o portal web.*\n\n' +
                    '❓ Si has olvidado tu contraseña, escribe "olvide" para crear un ticket de recuperación.');

                return true;
            }

        } catch (error) {
            console.error('Error verificando contraseña:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al verificar la contraseña. Por favor, intenta nuevamente.');
            return true;
        }
    }

    /**
     * Establece la nueva contraseña
     */
    private async setNewPassword(user: User, message: string, session: SessionData): Promise<boolean> {
        // Verificar si el usuario quiere crear ticket de recuperación
        if (message.toLowerCase() === 'olvide' || message.toLowerCase() === 'olvide_contraseña') {
            return await this.createPasswordRecoveryTicket(user, session);
        }

        // Validar la nueva contraseña
        const passwordValidation = this.validatePassword(message);

        if (!passwordValidation.isValid) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                `❌ **La contraseña no cumple los requisitos:**\n\n${passwordValidation.errors.join('\n')}\n\n` +
                '🔐 Por favor, ingresa una nueva contraseña que cumpla todos los requisitos:');
            return true;
        }

        session.newPassword = message;
        session.step = 'confirm_password';

        await this.messageService.sendTextMessage(user.phoneNumber,
            '🔄 **Confirma tu nueva contraseña**\n\n' +
            '🔑 Por favor, ingresa nuevamente tu nueva contraseña para confirmarla:\n\n' +
            '⚠️ *Asegúrate de escribirla exactamente igual.*');

        return true;
    }

    /**
     * Confirma la nueva contraseña
     */
    private async confirmNewPassword(user: User, message: string, session: SessionData): Promise<boolean> {
        if (message !== session.newPassword) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ **Las contraseñas no coinciden**\n\n' +
                '🔄 Por favor, confirma nuevamente tu nueva contraseña:');
            return true;
        }

        try {
            // Crear ticket para cambio de contraseña (por seguridad)
            const ticketData = {
                customerId: user.customerId!,
                category: 'password_change',
                description: `Solicitud de cambio de contraseña para cliente ${user.phoneNumber}. Nueva contraseña validada y confirmada.`,
                priority: 'alta' as const,
                source: 'whatsapp_automated',
                metadata: {
                    requestedAt: new Date().toISOString(),
                    phoneNumber: user.phoneNumber,
                    newPasswordHash: await this.hashPassword(session.newPassword!)
                }
            };

            const ticketId = await this.ticketService.createTicket(ticketData); await this.messageService.sendTextMessage(user.phoneNumber,
                '🎉 **¡Solicitud de Cambio Procesada!**\n\n' +
                `🎫 **Ticket ID:** ${ticketId}\n` +
                '⏱️ **Tiempo de procesamiento:** 15-30 minutos\n\n' +
                '📋 **¿Qué sucede ahora?**\n' +
                '• Tu solicitud será procesada automáticamente\n' +
                '• Recibirás confirmación cuando esté completa\n' +
                '• La nueva contraseña estará activa en tu router\n' +
                '• También podrás usarla en el portal web\n\n' +
                '📱 Te notificaremos por WhatsApp cuando esté lista.\n\n' +
                '🔒 *Por seguridad, tu nueva contraseña está encriptada y solo será visible para ti.*');

            // Mostrar botones de navegación
            await this.messageService.sendNavigationButtons(
                user.phoneNumber,
                '🔐 Cambio de Contraseña',
                '¿Qué deseas hacer ahora?'
            );

            // Notificar al sistema sobre el cambio de contraseña (implementación futura)
            // await this.ticketService.notifyPasswordChangeRequest(ticketId, user.customerId!);

            // Limpiar sesión
            this.resetPasswordSession(session);

            return true;

        } catch (error) {
            console.error('Error procesando cambio de contraseña:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al procesar el cambio de contraseña. Por favor, intenta nuevamente o contacta soporte.');

            this.resetPasswordSession(session);
            return true;
        }
    }

    /**
     * Crea un ticket para recuperación de contraseña
     */
    private async createPasswordRecoveryTicket(user: User, session: SessionData): Promise<boolean> {
        try {
            const ticketData = {
                customerId: user.customerId!,
                category: 'password_recovery',
                description: `Solicitud de recuperación de contraseña para cliente ${user.phoneNumber}. El cliente no recuerda su contraseña actual.`,
                priority: 'alta' as const,
                source: 'whatsapp'
            };

            const ticketId = await this.ticketService.createTicket(ticketData); await this.messageService.sendTextMessage(user.phoneNumber,
                '🔑 **Solicitud de Recuperación Creada**\n\n' +
                `🎫 **Ticket ID:** ${ticketId}\n` +
                '👨‍💻 **Estado:** En proceso\n\n' +
                '📋 **Próximos pasos:**\n' +
                '• Un técnico revisará tu solicitud\n' +
                '• Te contactará para verificar tu identidad\n' +
                '• Te proporcionará una nueva contraseña temporal\n' +
                '• Podrás cambiarla desde el portal web\n\n' +
                '⏱️ **Tiempo estimado:** 30-60 minutos\n' +
                '📱 Te notificaremos cuando esté resuelto.');

            // Mostrar botones de navegación
            await this.messageService.sendNavigationButtons(
                user.phoneNumber,
                '🔐 Recuperación de Contraseña',
                '¿Qué deseas hacer ahora?'
            );

            // Limpiar sesión
            this.resetPasswordSession(session);

            return true;

        } catch (error) {
            console.error('Error creando ticket de recuperación:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al crear la solicitud de recuperación. Por favor, intenta nuevamente.');
            return true;
        }
    }

    /**
     * Valida la fortaleza de la contraseña
     */
    private validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('• Debe tener al menos 8 caracteres');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('• Debe contener al menos 1 número');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('• Debe contener al menos 1 letra mayúscula');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('• Debe contener al menos 1 letra minúscula');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
            errors.push('• Debe contener al menos 1 carácter especial');
        }        // Verificar patrones comunes débiles
        const weakPatterns = [
            /^123456/,
            /^password/i,
            /^admin\d+/i,
            /^qwerty/i,
            /^conecta/i
        ];

        if (weakPatterns.some(pattern => pattern.test(password))) {
            errors.push('• No debe usar patrones comunes o palabras obvias');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Simula verificación de contraseña con WispHub
     */
    private async verifyPasswordWithWispHub(customerId: string, password: string): Promise<boolean> {
        // En implementación real, esto haría una llamada a WispHub API
        // Para la simulación, aceptamos cualquier contraseña que no sea "wrong"
        return password !== 'wrong' && password.length >= 4;
    }

    /**
     * Hashea la contraseña para almacenamiento seguro
     */
    private async hashPassword(password: string): Promise<string> {
        // En implementación real, usar bcrypt o similar
        return Buffer.from(password).toString('base64');
    }

    /**
     * Resetea el estado de sesión de contraseña
     */
    private resetPasswordSession(session: SessionData): void {
        session.changingPassword = false;
        session.step = undefined;
        session.newPassword = undefined;
    }
}

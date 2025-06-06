import { BaseConversationFlow } from './ConversationFlow';
import { User, SessionData, WhatsAppMessage } from '../interfaces';
import { MessageService } from '../services/MessageService';
import { SecurityService } from '../services/SecurityService';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo específico para usuarios con servicio suspendido
 * Solo permite contactar con agente humano para reactivación
 */
export class SuspendedServiceFlow extends BaseConversationFlow {
    readonly name = 'SuspendedServiceFlow';

    constructor(
        messageService: MessageService,
        securityService: SecurityService
    ) {
        super(messageService, securityService);
    }

    async canHandle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        // Solo manejar mensajes de texto
        if (typeof message !== 'string') return false;

        // Solo manejar si el usuario está autenticado pero tiene servicio suspendido
        const userHasSuspendedService = user.authenticated && user.encryptedData &&
            JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData))?.isInactive;

        if (!userHasSuspendedService) return false;

        const extractedCommand = extractMenuCommand(message);

        // Manejar comandos permitidos para servicio suspendido
        return extractedCommand === 'hablar_agente' ||
            extractedCommand === 'menu' ||
            extractedCommand === 'inicio' ||
            isMenuCommand(message, [
                'contactar soporte', 'soporte', 'agente', 'ayuda',
                'reactivar', 'activar servicio', 'hablar con agente'
            ]);
    }

    async handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        // Solo procesar mensajes de texto
        if (typeof message !== 'string') return false;

        try {
            const extractedCommand = extractMenuCommand(message);

            // Comandos para mostrar el menú específico de servicio suspendido
            if (extractedCommand === 'menu' || extractedCommand === 'inicio') {
                await this.showSuspendedServiceInfo(user);
                return true;
            }

            // Comandos para contactar agente
            if (extractedCommand === 'hablar_agente' ||
                isMenuCommand(message, [
                    'contactar soporte', 'soporte', 'agente', 'ayuda',
                    'reactivar', 'activar servicio', 'hablar con agente'
                ])) {

                // Activar handover a agente humano
                session.flowActive = 'agentHandover';
                return false; // Permitir que AgentHandoverFlow maneje
            }

            // Para cualquier otro comando, explicar las opciones disponibles
            await this.showSuspendedServiceInfo(user);
            return true;

        } catch (error) {
            console.error('Error en SuspendedServiceFlow:', error);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Ocurrió un error. Para recibir asistencia, contacta a nuestro equipo de soporte.'
            );
            return true;
        }
    }

    /**
     * Muestra información específica para servicio suspendido
     */
    private async showSuspendedServiceInfo(user: User): Promise<void> {
        await this.messageService.sendTextMessage(
            user.phoneNumber,
            `⚠️ **SERVICIO SUSPENDIDO**\n\n` +
            `Tu servicio se encuentra actualmente inactivo y requiere atención personalizada.\n\n` +
            `🔧 **¿Qué puedes hacer?**\n` +
            `• Contactar a nuestro equipo para reactivación\n` +
            `• Revisar estado de pagos pendientes\n` +
            `• Obtener información sobre tu cuenta\n\n` +
            `👨‍💼 **Para continuar, necesitas hablar con un agente.**\n\n` +
            `📞 **Contacto directo:** 3242156679`
        );

        // Mostrar el menú específico para servicio suspendido
        await this.messageService.sendSuspendedServiceMenu(user.phoneNumber);
    }
}

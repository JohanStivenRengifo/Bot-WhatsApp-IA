import { User, SessionData, WhatsAppMessage } from '../interfaces';
import { ConversationFlow } from './ConversationFlow';
import { extractMenuCommand } from '../utils/messageUtils';
import { MessageService } from '../services';
import { BotStateService } from '../services/BotStateService';

/**
 * Clase que administra los flujos de conversación
 */
export class ConversationFlowManager {
    private flows: ConversationFlow[] = [];
    private messageService: MessageService;
    private botStateService: BotStateService;

    constructor(messageService: MessageService) {
        this.messageService = messageService;
        this.botStateService = BotStateService.getInstance();
    }

    /**
     * Registra un nuevo flujo en el administrador
     */
    registerFlow(flow: ConversationFlow): void {
        this.flows.push(flow);
        console.log(`Flujo de conversación registrado: ${flow.name}`);
    }

    /**
     * Procesa un mensaje a través de los flujos registrados
     * @returns true si el mensaje fue manejado por algún flujo, false en caso contrario
     */
    async processMessage(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        // Extraer comando si es un mensaje de texto
        const msgText = typeof message === 'string' ? message : '';
        const command = extractMenuCommand(msgText);

        // Manejar comandos de navegación global
        if (command === 'menu' || command === 'inicio') {
            // Limpiar estado de sesión
            this.resetSessionFlowState(session);
            // Enviar menú principal
            await this.messageService.sendMainMenu(user.phoneNumber);
            return true;
        }

        if (command === 'finalizar') {
            // Limpiar estado de sesión
            this.resetSessionFlowState(session);
            // Enviar mensaje de despedida
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '✅ Gracias por usar nuestro servicio. ¡Hasta pronto! Si necesitas ayuda, escribe "menu" para volver al menú principal.'
            );
            return true;
        }        // Verificar cada flujo en orden
        for (const flow of this.flows) {
            try {
                // VERIFICAR SI EL FLUJO ESTÁ HABILITADO EN EL BOT
                const flowName = this.getFlowNameForChecking(flow.name);
                if (flowName && !this.botStateService.isFlowEnabled(flowName)) {
                    console.log(`Flujo '${flow.name}' está deshabilitado, saltando...`);
                    continue;
                }

                // Comprobar si el flujo puede manejar este mensaje
                if (await flow.canHandle(user, message, session)) {
                    console.log(`Mensaje evaluado por flujo: ${flow.name}`);
                    // Si el flujo puede manejar el mensaje, procesarlo
                    const handled = await flow.handle(user, message, session);

                    // Si el flujo manejó completamente el mensaje, terminar procesamiento
                    if (handled) {
                        console.log(`Mensaje completamente manejado por flujo: ${flow.name}`);
                        return true;
                    }

                    // Si el flujo retornó false, continuar con otros flujos
                    // Esto permite que flujos como ClientMenuFlow actúen como despachadores
                    console.log(`Flujo ${flow.name} configuró estado pero delegó manejo a otros flujos`);
                }
            } catch (error) {
                console.error(`Error en flujo ${flow.name}:`, error);
                this.botStateService.incrementErrorsCount();
                // Continuar con el siguiente flujo en caso de error
            }
        }

        // Ningún flujo pudo manejar el mensaje
        return false;
    }    /**
     * Limpia todos los estados de flujo en la sesión
     */
    private resetSessionFlowState(session: SessionData): void {
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
    }    /**
     * Mapea el nombre del flujo de clase al nombre usado en el sistema de control
     */
    private getFlowNameForChecking(flowClassName: string): string | null {
        const flowMapping: { [key: string]: string | null } = {
            'InitialSelectionFlow': 'initialSelection',
            'AuthenticationFlow': 'authentication',
            'SalesFlow': 'sales',
            'ClientMenuFlow': 'clientMenu',
            'AgentHandoverFlow': 'agentHandover',
            'TicketCreationFlow': 'ticketCreation',
            'InvoicesFlow': 'invoices',
            'PasswordChangeFlow': 'passwordChange',
            'PlanUpgradeFlow': 'planUpgrade',
            'PaymentReceiptFlow': 'paymentReceipt',
            'DebtInquiryFlow': 'debtInquiry',
            'LogoutFlow': 'logout',
            'SuspendedServiceFlow': 'suspendedService',
            'PrivacyPolicyFlow': null // Siempre habilitado
        };

        return flowMapping[flowClassName] || null;
    }
}

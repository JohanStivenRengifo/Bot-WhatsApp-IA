import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo que maneja la navegación del menú principal para clientes autenticados
 * Actúa como despachador central que redirige a los flujos específicos
 */
export class ClientMenuFlow extends BaseConversationFlow {
    readonly name: string = 'clientMenu';

    // Opciones válidas del menú principal
    private readonly menuOptions = [
        'ping', 'ticket', 'factura', 'deuda', 'puntos_pago',
        'cambiar_clave', 'mejorar_plan', 'validar_pago', 'menu', 'inicio'
    ];

    constructor(messageService: MessageService, securityService: SecurityService) {
        super(messageService, securityService);
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Solo manejar si:
        // 1. El usuario está autenticado
        // 2. No hay un flujo específico activo
        // 3. El mensaje es una opción del menú o comando de menú

        const extractedCommand = extractMenuCommand(message);

        return user.authenticated &&
            !session.creatingTicket &&
            !session.changingPassword &&
            !session.upgradingPlan &&
            !session.consultingInvoices &&
            !session.diagnosticInProgress &&
            (this.menuOptions.includes(extractedCommand) ||
                extractedCommand === 'menu' ||
                extractedCommand === 'inicio');
    }    /**
     * Maneja las selecciones del menú principal
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        try {
            // Comandos para mostrar el menú
            if (extractedCommand === 'menu' || extractedCommand === 'inicio') {
                await this.messageService.sendMainMenu(user.phoneNumber);
                return true;
            }

            // Limpiar cualquier estado de flujo anterior
            this.clearSessionFlags(session);

            // Redirigir según la selección
            switch (extractedCommand) {
                case 'ping':
                    // Activar diagnóstico de conexión
                    session.flowActive = 'ipDiagnostic';
                    session.diagnosticInProgress = true;
                    return false; // Permitir que IPDiagnosticFlow maneje

                case 'ticket':
                    // Activar creación de tickets
                    session.creatingTicket = true;
                    session.flowActive = 'ticketCreation';
                    return false; // Permitir que TicketCreationFlow maneje

                case 'factura':
                    // Activar consulta de facturas
                    session.consultingInvoices = true;
                    session.flowActive = 'invoices';
                    return false; // Permitir que InvoicesFlow maneje

                case 'deuda':
                    // Manejar consulta de deuda directamente aquí o redirigir
                    return false; // Permitir que DebtInquiryFlow maneje

                case 'puntos_pago':
                    // Activar flujo de puntos de pago
                    session.flowActive = 'paymentPoints';
                    return false; // Permitir que PaymentPointsFlow maneje

                case 'cambiar_clave':
                    // Activar cambio de contraseña
                    session.changingPassword = true;
                    session.flowActive = 'passwordChange';
                    return false; // Permitir que PasswordChangeFlow maneje

                case 'mejorar_plan':
                    // Activar mejora de plan
                    session.upgradingPlan = true;
                    session.flowActive = 'planUpgrade';
                    return false; // Permitir que PlanUpgradeFlow maneje

                case 'validar_pago':
                    // Activar validación de pago
                    session.flowActive = 'paymentReceipt';
                    return false; // Permitir que PaymentReceiptFlow maneje

                default:
                    // Opción no reconocida, mostrar menú nuevamente
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '❓ No entendí tu selección. Por favor, usa el menú interactivo para seleccionar una opción:');
                    await this.messageService.sendMainMenu(user.phoneNumber);
                    return true;
            }

        } catch (error) {
            console.error('Error en flujo de menú de cliente:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ha ocurrido un error. Te muestro el menú principal:');
            await this.messageService.sendMainMenu(user.phoneNumber);
            return true;
        }
    }

    /**
     * Limpia los flags de sesión para permitir que otros flujos tomen control
     */
    private clearSessionFlags(session: SessionData): void {
        session.flowActive = '';
        session.creatingTicket = false;
        session.changingPassword = false;
        session.upgradingPlan = false;
        session.consultingInvoices = false;
        session.diagnosticInProgress = false;
    }
}

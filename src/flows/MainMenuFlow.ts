import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';

/**
 * MainMenuFlow actúa como un despachador central solo para comandos de menú y ayuda.
 * Para todos los demás comandos, delega a los flujos especializados correspondientes.
 */
export class MainMenuFlow extends BaseConversationFlow {
    readonly name: string = 'mainMenu';

    // Únicamente comandos que este flujo maneja directamente
    private readonly directCommands = [
        'menu', 'inicio', 'ayuda', 'help'
    ];

    constructor(messageService: MessageService, securityService: SecurityService) {
        super(messageService, securityService);
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual.
     * Solo manejará directamente comandos de menú y ayuda.
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo solo maneja mensajes de menú y ayuda cuando:
        // 1. El usuario está autenticado
        // 2. No está en otro flujo específico (como creación de ticket)
        // 3. El mensaje es exactamente un comando de menú o ayuda

        const normalizedMessage = message.toLowerCase().trim();

        return user.authenticated &&
            !session.creatingTicket &&
            !session.changingPassword &&
            this.directCommands.includes(normalizedMessage);
    }

    /**
     * Maneja solamente los comandos de menú y ayuda
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const command = message.toLowerCase().trim();

        if (command === 'menu' || command === 'inicio') {
            await this.messageService.sendMainMenu(user.phoneNumber);
            return true;
        } else if (command === 'ayuda' || command === 'help') {
            await this.sendHelpInfo(user);
            return true;
        }

        // Este flujo no debería llegar aquí, ya que canHandle solo retorna true
        // para 'menu', 'inicio', 'ayuda' y 'help'
        return false;
    }

    /**
     * Envía información de ayuda al usuario
     */
    private async sendHelpInfo(user: User): Promise<void> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            '📚 *Centro de Ayuda*\n\n' +
            'Estos son los comandos disponibles:\n\n' +
            '• *menu* - Mostrar menú principal\n' +
            '• *factura* - Consultar facturas\n' +
            '• *deuda* - Ver saldo pendiente\n' +
            '• *ping* - Probar tu conexión\n' +
            '• *ticket* - Crear un ticket de soporte\n' +
            '• *cambiar_clave* - Cambiar tu contraseña\n' +
            '• *puntos_pago* - Ver opciones de pago\n' +
            '• *mejorar_plan* - Consultar mejores planes\n\n' +
            'Si necesitas hablar con un agente humano, escribe "agente".');
    }
}

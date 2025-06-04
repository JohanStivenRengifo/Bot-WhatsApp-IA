import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';

/**
 * Flujo para el menú principal y comandos generales
 */
export class MainMenuFlow extends BaseConversationFlow {
    readonly name: string = 'mainMenu';

    constructor(messageService: MessageService, securityService: SecurityService) {
        super(messageService, securityService);
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario está autenticado
        // 2. No está en otro flujo específico (como creación de ticket)
        // 3. El mensaje es un comando principal
        return user.authenticated &&
            !session.creatingTicket &&
            !session.changingPassword &&
            this.isMainCommand(message);
    }

    /**
     * Maneja los comandos principales
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const command = message.toLowerCase().trim();

        switch (command) {
            case 'menu':
            case 'inicio':
                await this.messageService.sendMainMenu(user.phoneNumber);
                return true;

            case 'ping':
            case 'test_conexion':
                await this.handlePingRequest(user);
                return true;

            case 'factura':
            case 'invoice':
                await this.handleInvoiceRequest(user);
                return true;

            case 'deuda':
            case 'saldo':
                await this.handleDebtInquiry(user);
                return true;

            case 'puntos_pago':
                await this.handlePaymentPoints(user);
                return true;

            case 'cambiar_clave':
            case 'password':
                await this.handlePasswordChangeRequest(user, session);
                return true;

            case 'mejorar_plan':
                await this.handlePlanUpgradeRequest(user);
                return true;

            case 'ayuda':
            case 'help':
                await this.handleHelpRequest(user);
                return true;

            // Si llega aquí, no es un comando principal
            default:
                return false;
        }
    }

    /**
     * Verifica si el mensaje es un comando principal
     */
    private isMainCommand(message: string): boolean {
        const mainCommands = [
            'menu', 'inicio', 'ping', 'test_conexion',
            'factura', 'invoice', 'deuda', 'saldo',
            'puntos_pago', 'cambiar_clave', 'password',
            'mejorar_plan', 'ayuda', 'help'
        ];

        return mainCommands.includes(message.toLowerCase().trim());
    }

    /**
     * Maneja la solicitud de ping/test de conexión
     */
    private async handlePingRequest(user: User): Promise<void> {
        // Aquí iría la implementación del ping, que debería delegarse a otra clase
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🔄 Realizando prueba de conexión...\n\n' +
            'Esto puede tomar unos segundos, por favor espera.');

        // Simular una respuesta exitosa
        setTimeout(async () => {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ Prueba completada\n\n' +
                '📶 *Estado de conexión:* Activa\n' +
                '⏱️ *Latencia:* 45ms\n' +
                '🔄 *Paquetes:* 4/4 recibidos\n\n' +
                'Tu conexión se encuentra funcionando correctamente.');
        }, 2000);
    }

    /**
     * Maneja la solicitud de factura
     */
    private async handleInvoiceRequest(user: User): Promise<void> {
        // Simular respuesta
        await this.messageService.sendTextMessage(user.phoneNumber,
            '📋 *Últimas facturas*\n\n' +
            '📄 Mayo 2025 - $58.900 - *Pagada*\n' +
            '📄 Junio 2025 - $58.900 - *Pendiente*\n\n' +
            'Para descargar tu factura más reciente, haz clic en el botón de abajo:');

        // Aquí debería mostrarse un botón para descargar la factura
    }

    /**
     * Maneja la consulta de deuda
     */
    private async handleDebtInquiry(user: User): Promise<void> {
        // Simular respuesta
        await this.messageService.sendTextMessage(user.phoneNumber,
            '💰 *Estado de Cuenta*\n\n' +
            '📆 *Fecha de corte:* 20 de junio 2025\n' +
            '💸 *Saldo pendiente:* $58.900\n' +
            '⚠️ *Estado:* Pendiente de pago\n\n' +
            '¿Deseas conocer las opciones de pago disponibles?');
    }

    /**
     * Maneja la solicitud de puntos de pago
     */
    private async handlePaymentPoints(user: User): Promise<void> {
        // Simular respuesta
        await this.messageService.sendTextMessage(user.phoneNumber,
            '📍 *Puntos de Pago Disponibles*\n\n' +
            '1️⃣ *Efecty*\n' +
            'Convenio: 123456\n' +
            'Referencia: Tu número de documento\n\n' +
            '2️⃣ *Banco Popular*\n' +
            'Cuenta: 123-456789-01\n' +
            'Tipo: Ahorros\n\n' +
            '3️⃣ *PSE*\n' +
            'A través de nuestro portal web\n\n' +
            '4️⃣ *Baloto*\n' +
            'Convenio: 987654\n' +
            'Referencia: Tu número de documento');
    }

    /**
     * Maneja la solicitud de cambio de contraseña
     */
    private async handlePasswordChangeRequest(user: User, session: SessionData): Promise<void> {
        session.changingPassword = true;
        session.step = 'current_password';

        await this.messageService.sendTextMessage(user.phoneNumber,
            '🔐 *Cambio de Contraseña*\n\n' +
            'Para tu seguridad, necesito verificar tu identidad.\n\n' +
            'Ingresa tu contraseña actual:');
    }

    /**
     * Maneja la solicitud de mejora de plan
     */
    private async handlePlanUpgradeRequest(user: User): Promise<void> {
        // Simular respuesta
        await this.messageService.sendTextMessage(user.phoneNumber,
            '⬆️ *Mejora tu Plan*\n\n' +
            '📊 *Tu plan actual:* Básico - 20/5 Mbps - $58.900\n\n' +
            'Planes disponibles para mejorar:\n\n' +
            '🥈 *Plan Premium*\n' +
            '📶 30/10 Mbps\n' +
            '💰 $78.900/mes\n\n' +
            '🥇 *Plan Ultra*\n' +
            '📶 50/20 Mbps\n' +
            '💰 $98.900/mes\n\n' +
            'Para solicitar un cambio de plan, por favor responde con el nombre del plan que deseas.');
    }

    /**
     * Maneja la solicitud de ayuda
     */
    private async handleHelpRequest(user: User): Promise<void> {
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

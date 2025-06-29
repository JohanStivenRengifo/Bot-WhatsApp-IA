import { SessionData } from '../interfaces/WhatsAppMessage';
import { User } from '../interfaces/User';
import { MessageService } from '../services/MessageService';
import { ConversationFlow } from './ConversationFlow';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

interface PaymentPointSession extends SessionData {
    consultingPaymentPoints?: boolean;
}

export class PaymentPointsFlow implements ConversationFlow {
    readonly name = 'PaymentPointsFlow';

    private messageService: MessageService;

    constructor(messageService: MessageService) {
        this.messageService = messageService;
    } async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Si el flujo ya está activo (activado por ClientMenuFlow)
        if (session.flowActive === 'paymentPoints') {
            return true;
        }

        const extractedCommand = extractMenuCommand(message);
        return extractedCommand === 'puntos_pago' ||
            isMenuCommand(message, ['puntos de pago', 'lugares de pago', 'ubicaciones para pagar']);
    } async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Mostrar información de puntos de pago
        await this.showPaymentInfo(user.phoneNumber);

        // Limpiar estado de sesión después de procesar
        session.flowActive = '';

        // Indicar que se ha manejado el mensaje
        return true;
    } private async showPaymentInfo(phoneNumber: string): Promise<void> {
        const paymentMessage = `
💳 *MEDIOS DE PAGO ELECTRÓNICOS*

📱 *CORRESPONSAL BANCOLOMBIA ó APP*
**CONVENIO:** 94375 + TU CÓDIGO USUARIO

🏦 *BANCOLOMBIA AHORROS*
**Cuenta:** 26100006596
**NIT:** 901707684
**Titular:** Conecta2 Telecomunicaciones

💜 *NEQUI*
**Número:** 3242156679

🏛️ *DAVIVIENDA AHORROS*
**Cuenta:** 0488403242917

📷 *VALIDACIÓN DE PAGO:*
Enviar foto del comprobante para validar el pago
**WhatsApp:** 3242156679

⚠️ *IMPORTANTE:*
**RECONEXIÓN DE $7.000 DESPUÉS DEL DÍA 15**

O mediante: https://clientes.portalinternet.app/saldo/conecta2tel/`;

        await this.messageService.sendTextMessage(phoneNumber, paymentMessage);

        // Añadir botones de navegación
        await this.messageService.sendActionButtons(
            phoneNumber,
            '💳 Información de Pago',
            '¿Qué te gustaría hacer ahora?',
            [
                { id: 'validar_pago', title: '📷 Enviar Comprobante' },
                { id: 'deuda', title: '💰 Consultar Deuda' },
                { id: 'menu', title: '🏠 Menú Principal' }
            ]
        );
    }
}
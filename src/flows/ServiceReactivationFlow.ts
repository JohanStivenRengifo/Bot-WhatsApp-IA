import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService, PaymentService } from '../services';

/**
 * Flujo para la reactivación de servicios inactivos
 */
export class ServiceReactivationFlow extends BaseConversationFlow {
    readonly name: string = 'serviceReactivation';

    private customerService: CustomerService;
    private paymentService: PaymentService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService,
        paymentService: PaymentService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
        this.paymentService = paymentService;
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario está autenticado
        // 2. El usuario tiene un servicio inactivo
        // 3. El mensaje es un comando de reactivación

        if (!user.authenticated || !user.encryptedData) return false;

        try {
            const userData = this.decodeUserData(user);
            return userData?.isInactive &&
                (message.toLowerCase() === 'reactivar' ||
                    message === 'reactivar_servicio');
        } catch (error) {
            console.error('Error verificando si puede manejar reactivación:', error);
            return false;
        }
    }

    /**
     * Maneja el proceso de reactivación de servicio
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {            // Obtener información de deuda del cliente
            const debtInfo = await this.customerService.getCustomerDebt(user.customerId!);

            if (!debtInfo || debtInfo.totalAmount <= 0) {
                // Si no hay deuda, informar que debe contactar soporte
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '⚠️ No se encontraron deudas pendientes en tu cuenta.\n\n' +
                    'Tu servicio podría estar inactivo por otras razones técnicas o administrativas.\n\n' +
                    'Por favor, contacta directamente a nuestro equipo de soporte para reactivar tu servicio.');
                return true;
            }

            // Mostrar información de la deuda
            await this.messageService.sendTextMessage(user.phoneNumber,
                `💰 *Información de Deuda*\n\n` +
                `Monto pendiente: $${debtInfo.totalAmount.toLocaleString('es-CO')}\n` +
                `Facturas vencidas: ${debtInfo.invoicesCount}\n` +
                `Estado: ${this.getStatusLabel(debtInfo.status)}\n\n` +
                `Para reactivar tu servicio, es necesario realizar el pago del saldo pendiente.`);

            // Mostrar opciones de pago
            session.handlingReactivation = true;
            await this.messageService.sendPaymentOptions(user.phoneNumber);

            return true;
        } catch (error) {
            console.error('Error en flujo de reactivación:', error);

            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error al procesar tu solicitud de reactivación.\n\n' +
                'Por favor, intenta nuevamente en unos momentos o contacta directamente a nuestro servicio al cliente.');

            return true;
        }
    }

    /**
     * Obtiene una etiqueta amigable para el estado de la deuda
     */
    private getStatusLabel(status: string): string {
        const statusLabels: { [key: string]: string } = {
            'pending': 'Pendiente de pago',
            'overdue': 'Vencida',
            'critical': 'Crítica - Servicio suspendido',
            'partial': 'Pago parcial pendiente'
        };

        return statusLabels[status.toLowerCase()] || 'Pendiente';
    }
}

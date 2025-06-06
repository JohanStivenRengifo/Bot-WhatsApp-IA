import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo para consultar deuda del cliente
 */
export class DebtInquiryFlow extends BaseConversationFlow {
    readonly name: string = 'debtInquiry';

    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        return user.authenticated && (
            extractedCommand === 'deuda' ||
            isMenuCommand(message, ['consultar deuda', 'saldo pendiente', 'ver saldo'])
        );
    }

    /**
     * Maneja la consulta de deuda
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Intentar obtener información de deuda
            let debtInfo;
            try {
                debtInfo = await this.customerService.getCustomerDebt(user.customerId!);
            } catch (apiError) {
                console.error('Error en API al consultar deuda:', apiError);
                debtInfo = null;
            }

            if (!debtInfo) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Lo siento, no pude obtener la información de tu deuda en este momento.\n\n' +
                    'Por favor, intenta nuevamente más tarde o contacta a nuestro servicio al cliente.');

                // Ofrecer volver al menú principal
                await this.messageService.sendNavigationButtons(
                    user.phoneNumber,
                    '⚠️ Error en Consulta',
                    '¿Qué te gustaría hacer ahora?'
                );
                return true;
            }

            let debtMessage = '';
            if (debtInfo.totalDebt === 0) {
                debtMessage = '✅ *¡Felicitaciones!*\n\n' +
                    '🎉 No tienes deudas pendientes\n' +
                    '📊 Tu cuenta está al día';
            } else {
                debtMessage = `💰 *Resumen de Deuda*\n\n` +
                    `🔴 Total adeudado: $${debtInfo.totalDebt.toLocaleString()}\n` +
                    `📄 Facturas pendientes: ${debtInfo.pendingInvoices}\n` +
                    `📅 Próxima fecha límite: ${debtInfo.nextDueDate ? new Date(debtInfo.nextDueDate).toLocaleDateString() : 'No disponible'}\n\n` +
                    `💡 Paga antes del vencimiento para evitar suspensión del servicio.`;
            }

            await this.messageService.sendTextMessage(user.phoneNumber, debtMessage);            // Ofrecer opciones adicionales si hay deuda
            if (debtInfo.totalDebt > 0) {
                const paymentOptionsMessage = {
                    messaging_product: 'whatsapp',
                    to: user.phoneNumber,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: {
                            text: '¿Te ayudo con algo más sobre tu deuda?'
                        },
                        action: {
                            buttons: [
                                {
                                    type: 'reply',
                                    reply: {
                                        id: 'puntos_pago',
                                        title: '📍 Ver Formas de Pago'
                                    }
                                },
                                {
                                    type: 'reply',
                                    reply: {
                                        id: 'factura',
                                        title: '📄 Ver Facturas'
                                    }
                                },
                                {
                                    type: 'reply',
                                    reply: {
                                        id: 'menu',
                                        title: '🏠 Menú Principal'
                                    }
                                }
                            ]
                        }
                    }
                };

                await this.messageService.sendMessage(paymentOptionsMessage);
            } else {
                // Si no hay deuda, mostrar botón de volver al menú
                await this.messageService.sendNavigationButtons(
                    user.phoneNumber,
                    '✅ Consulta Completada',
                    '¿Qué te gustaría hacer ahora?'
                );
            }

            return true;

        } catch (error) {
            console.error('Error al consultar deuda:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                'Lo siento, ocurrió un error al consultar tu deuda. Por favor, intenta nuevamente más tarde.');
            return true;
        }
    }
}

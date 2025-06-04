import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';
import axios from 'axios';
import { config } from '../config';

/**
 * Flujo para consultar facturas y deudas usando WispHub API
 */
export class InvoicesFlow extends BaseConversationFlow {
    readonly name: string = 'invoices';

    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        return (
            message === 'facturas_deudas' ||
            session.flowActive === 'invoices'
        );
    }

    /**
     * Maneja el proceso de consulta de facturas
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            if (!user.authenticated) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '🔐 Necesitas estar autenticado para consultar facturas.');
                return true;
            }

            session.flowActive = 'invoices';

            // Obtener el ID del servicio del usuario
            const userData = this.decodeUserData(user);
            const serviceId = userData?.serviceId || user.customerId;

            if (!serviceId) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ No se pudo obtener la información de tu servicio. Contacta a soporte.');
                return true;
            }

            await this.messageService.sendTextMessage(user.phoneNumber,
                '📄 Consultando tus facturas y estado de cuenta...\n\n⏳ Por favor espera un momento.');

            // Consultar facturas desde WispHub API
            const invoices = await this.getCustomerInvoices(serviceId);

            if (invoices.length === 0) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '📄 No se encontraron facturas en tu cuenta.\n\n' +
                    '✨ Si crees que esto es un error, contacta a nuestro soporte técnico.');
                return true;
            }

            // Mostrar resumen de facturas
            await this.showInvoicesSummary(user, invoices);

            // Mostrar opciones adicionales
            await this.showInvoiceOptions(user);

            return true;

        } catch (error) {
            console.error('Error en flujo de facturas:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar facturas. Por favor, intenta más tarde o contacta a soporte.');
            return true;
        }
    }

    /**
     * Obtiene las facturas del cliente desde WispHub API
     */
    private async getCustomerInvoices(serviceId: string): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}facturas/`, {
                headers: {
                    'Authorization': config.wisphub.apiKey
                },
                params: {
                    servicio: serviceId,
                    limit: 12, // Últimas 12 facturas (1 año)
                    ordering: '-fecha_emision'
                }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Error consultando facturas en WispHub:', error);
            return [];
        }
    }

    /**
     * Muestra el resumen de facturas
     */
    private async showInvoicesSummary(user: User, invoices: any[]): Promise<void> {
        let summary = '📊 *RESUMEN DE FACTURAS*\n\n';

        let totalDebt = 0;
        let pendingCount = 0;
        let paidCount = 0;

        // Analizar facturas
        invoices.forEach(invoice => {
            if (invoice.estado === 'pendiente' || invoice.estado === 'vencida') {
                totalDebt += parseFloat(invoice.valor_total || 0);
                pendingCount++;
            } else if (invoice.estado === 'pagada') {
                paidCount++;
            }
        });

        summary += `💰 *Deuda Total:* $${totalDebt.toLocaleString('es-CO')}\n`;
        summary += `📄 *Facturas Pendientes:* ${pendingCount}\n`;
        summary += `✅ *Facturas Pagadas:* ${paidCount}\n\n`;

        // Mostrar últimas 5 facturas
        summary += '📋 *ÚLTIMAS FACTURAS:*\n\n';

        invoices.slice(0, 5).forEach((invoice, index) => {
            const date = new Date(invoice.fecha_emision).toLocaleDateString('es-CO');
            const amount = parseFloat(invoice.valor_total || 0).toLocaleString('es-CO');
            const status = this.getStatusEmoji(invoice.estado);

            summary += `${index + 1}. 📅 ${date}\n`;
            summary += `   💵 $${amount}\n`;
            summary += `   ${status} ${this.getStatusText(invoice.estado)}\n\n`;
        });

        if (totalDebt > 0) {
            summary += '⚠️ *IMPORTANTE:* Tienes facturas pendientes de pago.\n';
            summary += 'Puedes pagar a través de nuestros puntos autorizados o transferencia bancaria.';
        } else {
            summary += '✨ ¡Excelente! Tu cuenta está al día.';
        }

        await this.messageService.sendTextMessage(user.phoneNumber, summary);
    }

    /**
     * Muestra opciones adicionales para facturas
     */
    private async showInvoiceOptions(user: User): Promise<void> {
        const optionsMessage = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '💼 Opciones de Facturas'
                },
                body: {
                    text: '¿Qué más necesitas hacer?'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'puntos_pago',
                                title: '🏦 Puntos de Pago'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'comprobante_pago',
                                title: '💳 Enviar Comprobante'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'menu_principal',
                                title: '🏠 Menú Principal'
                            }
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(optionsMessage);
    }

    /**
     * Obtiene el emoji para el estado de la factura
     */
    private getStatusEmoji(status: string): string {
        switch (status?.toLowerCase()) {
            case 'pagada': return '✅';
            case 'pendiente': return '⏳';
            case 'vencida': return '🔴';
            default: return '❓';
        }
    }

    /**
     * Obtiene el texto para el estado de la factura
     */
    private getStatusText(status: string): string {
        switch (status?.toLowerCase()) {
            case 'pagada': return 'Pagada';
            case 'pendiente': return 'Pendiente de Pago';
            case 'vencida': return 'Vencida';
            default: return 'Estado Desconocido';
        }
    }
}

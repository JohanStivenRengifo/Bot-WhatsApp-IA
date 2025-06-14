import moment from 'moment';
import { MessageService, CustomerService } from '../services';
import { OverdueCustomer, User } from '../interfaces';

export class NotificationController {
    private users: Map<string, User>;
    private messageService: MessageService;
    private customerService: CustomerService;

    constructor(users: Map<string, User>) {
        this.users = users;
        this.messageService = MessageService.getInstance();
        this.customerService = new CustomerService();
    }

    async startNotificationSystem(): Promise<void> {
        // Check for overdue invoices every hour
        setInterval(async () => {
            await this.checkOverdueInvoices();
        }, 60 * 60 * 1000);

        // Check for service outages every 10 minutes
        setInterval(async () => {
            await this.checkServiceOutages();
        }, 10 * 60 * 1000);

        console.log('Notification system started');
    }

    private async checkOverdueInvoices(): Promise<void> {
        try {
            const overdueCustomers = await this.customerService.getOverdueCustomers() as OverdueCustomer[];

            for (const customer of overdueCustomers) {
                const user = Array.from(this.users.values()).find(u => u.customerId === customer.id);

                if (user && user.acceptedPrivacyPolicy) {
                    const daysOverdue = moment().diff(moment(customer.lastDueDate), 'days');

                    let notificationMessage = '';
                    if (daysOverdue <= 3) {
                        notificationMessage = `⚠️ *Recordatorio de Pago*\n\n` +
                            `Hola ${customer.name}, tu factura tiene ${daysOverdue} día(s) de vencida.\n\n` +
                            `💰 Valor: ${customer.amount.toLocaleString()}\n` +
                            `📅 Venció: ${moment(customer.lastDueDate).format('DD/MM/YYYY')}\n\n` +
                            `Paga hoy para evitar la suspensión del servicio.`;
                    } else if (daysOverdue <= 7) {
                        notificationMessage = `🚨 *Suspensión Inminente*\n\n` +
                            `${customer.name}, tu servicio será suspendido mañana por mora de ${daysOverdue} días.\n\n` +
                            `💰 Valor adeudado: ${customer.amount.toLocaleString()}\n\n` +
                            `¡Paga urgentemente para mantener tu servicio activo!`;
                    }

                    if (notificationMessage) {
                        await this.messageService.sendTextMessage(user.phoneNumber, notificationMessage);
                        await this.messageService.sendPaymentOptions(user.phoneNumber);
                    }
                }
            }
        } catch (error) {
            console.error('Check overdue invoices error:', error);
        }
    } private async checkServiceOutages(): Promise<void> {
        try {
            console.log('📊 Comprobando interrupciones de servicio...');
            const outages = await this.customerService.getServiceOutages();
            console.log(`✅ ${outages.length} interrupciones de servicio encontradas`);

            for (const outage of outages) {
                const affectedUsers = await this.customerService.getAffectedUsers(outage.area);

                for (const user of affectedUsers) {
                    const whatsappUser = Array.from(this.users.values()).find(u => u.customerId === user.id);

                    if (whatsappUser && whatsappUser.acceptedPrivacyPolicy) {
                        const outageMessage = `🔧 *Mantenimiento Programado*\n\n` +
                            `Estimado ${user.name},\n\n` +
                            `Te informamos que realizaremos mantenimiento en tu zona:\n\n` +
                            `📍 Área: ${outage.area}\n` +
                            `🕐 Inicio: ${moment(outage.startTime).format('DD/MM/YYYY HH:mm')}\n` +
                            `⏰ Duración estimada: ${outage.duration} horas\n\n` +
                            `El servicio se restablecerá automáticamente. Disculpa las molestias.`;

                        await this.messageService.sendTextMessage(whatsappUser.phoneNumber, outageMessage);
                    }
                }
            }
        } catch (error) {
            console.error('Check service outages error:', error);
        }
    }
}
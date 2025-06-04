import axios from 'axios';
import moment from 'moment';
import { config } from '../config';
import { Ticket } from '../interfaces/Ticket';
import { CustomerService } from './CustomerService';

export class TicketService {
    private customerService: CustomerService;

    constructor() {
        this.customerService = new CustomerService();
    }

    async createTicket(ticketData: {
        customerId: string;
        category?: string;
        description: string;
        priority?: 'alta' | 'media' | 'baja';
    }): Promise<string> {
        try {
            // Obtener información del cliente
            const customerInfo = await this.customerService.getCustomerInfo(ticketData.customerId);
            const customerServiceInfo = await this.customerService.getCustomerServiceInfo(ticketData.customerId);

            // Generar fechas estimadas
            const createdAt = new Date();
            const estimatedStartDate = moment(createdAt).add(1, 'days').toDate();
            const estimatedEndDate = moment(estimatedStartDate).add(
                this.getEstimatedDays(ticketData.priority || 'media'),
                'days'
            ).toDate();

            // Crear el asunto basado en la categoría y descripción
            const subject = this.generateTicketSubject(ticketData.category, ticketData.description);

            // Asignar técnico basado en la categoría (simulado)
            const technician = this.assignTechnician(ticketData.category);

            // Construir objeto de ticket completo
            const ticket: Ticket = {
                id: this.generateTicketId(),
                customerId: ticketData.customerId,
                subject: subject,
                description: ticketData.description,
                status: 'nuevo',
                priority: ticketData.priority || 'media',
                technician: technician,
                createdAt: createdAt,
                createdBy: 'Bot WhatsApp - Sistema Automatizado',
                estimatedStartDate: estimatedStartDate,
                estimatedEndDate: estimatedEndDate,

                // Información del cliente
                clientInfo: {
                    name: customerInfo.name || 'Cliente',
                    address: customerInfo.address || '',
                    phone: customerInfo.phone || '',
                    comments: customerInfo.comments || ''
                },

                // Información del servicio
                serviceInfo: customerServiceInfo
            };

            // Aquí iría la lógica para guardar el ticket en la base de datos
            // Por ahora solo retornamos el ID
            return ticket.id;
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }
    }

    async notifyNewTicket(ticketId: string, customerId: string): Promise<void> {
        try {
            await axios.post(`${config.crm.baseUrl}/api/v1/tickets/${ticketId}/notifications`, {
                type: 'whatsapp_created',
                customer_id: customerId,
                channel: 'whatsapp'
            }, {
                headers: {
                    'Authorization': `Bearer ${config.crm.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Notify new ticket error:', error);
        }
    }

    getCategoryName(categoryId: string): string {
        const categories: { [key: string]: string } = {
            'internet_lento': 'Internet Lento',
            'sin_internet': 'Sin Conexión a Internet',
            'intermitente': 'Conexión Intermitente',
            'facturacion': 'Problema de Facturación',
            'otro': 'Otro Problema',
            'tv': 'Problema de Televisión',
            'cambio_equipo': 'Cambio de Equipo',
            'cancelacion': 'Cancelación de Servicio'
        };

        return categories[categoryId] || 'Consulta General';
    }

    /**
     * Genera un ID de ticket basado en la fecha y un número aleatorio
     */
    private generateTicketId(): string {
        const date = new Date();
        const year = date.getFullYear();
        const randomNum = Math.floor(Math.random() * 1000);
        return `${randomNum}`;
    }

    /**
     * Genera un asunto para el ticket basado en la categoría y descripción
     */
    private generateTicketSubject(category: string | undefined, description: string): string {
        if (!category) {
            return `Ticket de soporte - ${description.substring(0, 50)}...`;
        }
        return `[${this.getCategoryName(category)}] ${description.substring(0, 50)}...`;
    }

    /**
     * Asigna un técnico basado en la categoría del ticket (simulado)
     */    private assignTechnician(category: string | undefined): string {
        const technicians = {
            internet: 'Juan Pérez',
            router: 'Ana Gómez',
            facturacion: 'Carlos Ruiz',
            default: 'Soporte General'
        };

        if (!category) {
            return technicians.default;
        }

        return technicians[category as keyof typeof technicians] || technicians.default;
    }

    /**
     * Calcula días estimados para resolver según prioridad
     */
    private getEstimatedDays(priority: string): number {
        switch (priority.toLowerCase()) {
            case 'alta':
                return 1;
            case 'media':
                return 5;
            case 'baja':
                return 12;
            default:
                return 7;
        }
    }
}
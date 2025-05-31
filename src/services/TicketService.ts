import axios from 'axios';
import { config } from '../config';

export class TicketService {
    async createTicket(customerId: string, subject: string, description: string): Promise<string> {
        try {
            const ticketData = {
                customer_id: customerId,
                subject: subject,
                description: description,
                priority: 'medium',
                source: 'whatsapp'
            };

            const response = await axios.post(`${config.crm.baseUrl}/api/v1/tickets`, ticketData, {
                headers: {
                    'Authorization': `Bearer ${config.crm.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.ticket_id;
        } catch (error) {
            console.error('Create ticket error:', error);
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
            'otro': 'Otro Problema'
        };

        return categories[categoryId] || 'Consulta General';
    }
}
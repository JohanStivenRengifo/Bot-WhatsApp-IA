import axios from 'axios';
import { config } from '../config';
import { PaymentPoint } from '../interfaces';

export class PaymentService {
    async getPaymentPoints(): Promise<PaymentPoint[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/payment-points`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get payment points error:', error);
            return [];
        }
    }

    getInvoiceStatusText(status: string): string {
        switch (status) {
            case 'paid': return 'Pagada';
            case 'pending': return 'Pendiente';
            case 'overdue': return 'Vencida';
            default: return 'Desconocido';
        }
    }
}
import axios from 'axios';
import { config } from '../config';
import { PaymentPoint } from '../interfaces';

interface PendingInvoice {
    id: string;
    amount: number;
    dueDate: string;
    reference: string;
    status: 'pending' | 'overdue';
    description?: string;
}

interface PaymentData {
    amount: number;
    date: string;
    reference: string;
    bank: string;
    source: string;
    imageAnalysis?: boolean;
}

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

    async getPendingInvoices(customerId: string): Promise<PendingInvoice[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/${customerId}/invoices/pending`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get pending invoices error:', error);
            // Simular datos para desarrollo
            return [
                {
                    id: 'inv_001',
                    amount: 58900,
                    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    reference: `REF${Math.floor(Math.random() * 100000)}`,
                    status: 'pending',
                    description: 'Servicio de Internet - Mes actual'
                }
            ];
        }
    }

    async registerPayment(customerId: string, paymentData: PaymentData): Promise<boolean> {
        try {
            const response = await axios.post(`${config.wisphub.baseUrl}/customers/${customerId}/payments`, {
                ...paymentData,
                registeredAt: new Date().toISOString(),
                verificationMethod: paymentData.imageAnalysis ? 'ai_image_analysis' : 'manual'
            }, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.status === 200 || response.status === 201;
        } catch (error) {
            console.error('Register payment error:', error);
            // En desarrollo, simular éxito
            return true;
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
import axios from 'axios';
import ping from 'ping';
import { config } from '../config';
import { Invoice, CustomerData, PlanData, DebtInfo, OverdueCustomer } from '../interfaces';

// Interface for WispHub API customer response
interface WispHubCustomer {
    id_servicio: string;
    nombre?: string;
    documento?: string;
    cedula?: string;
    email?: string;
    ip?: string;
    estado?: string;
}

export class CustomerService {
    async authenticateCustomer(documentNumber: string): Promise<CustomerData | null> {
        try {
            // Paso 1: Buscar el cliente por número de documento en la API de WispHub
            const searchResponse = await axios.get(`${config.wisphub.baseUrl}/clientes`, {
                headers: { 'Authorization': config.wisphub.apiKey },
                params: { documento: documentNumber }
            });

            // Verificar si hay datos en la respuesta
            if (!searchResponse.data || !searchResponse.data.results || searchResponse.data.results.length === 0) {
                console.log('No se encontró cliente con ese número de documento');
                return null;
            }

            // Obtener el cliente de los resultados
            const cliente = searchResponse.data.results[0];
            if (!cliente || !cliente.id) {
                console.log('Cliente encontrado pero sin ID válido');
                return null;
            }

            // Paso 2: Consultar los detalles del servicio para verificar si está activo
            const serviceResponse = await axios.get(`${config.wisphub.baseUrl}/clientes/${cliente.id}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            // Verificar si el servicio está activo
            if (!serviceResponse.data || serviceResponse.data.estado !== 'activo') {
                console.log('Cliente encontrado pero servicio no activo');
                return null;
            }

            // Mapear la respuesta al formato CustomerData
            const customerData: CustomerData = {
                id: cliente.id,
                name: cliente.nombre || 'Cliente',
                email: cliente.email,
                document: documentNumber,
                ip_address: cliente.ip || '',
                status: serviceResponse.data.estado
            };

            return customerData;
        } catch (error) {
            console.error('Customer authentication error:', error);
            return null;
        }
    }

    async getCustomerInfo(customerId: string): Promise<CustomerData> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/clientes/${customerId}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return {
                id: response.data.id,
                name: response.data.nombre || 'Cliente',
                email: response.data.email,
                document: response.data.documento || response.data.cedula,
                ip_address: response.data.ip || '',
                status: response.data.estado
            };
        } catch (error) {
            console.error('Get customer info error:', error);
            throw error;
        }
    }

    async pingIP(ipAddress: string): Promise<ping.PingResponse> {
        try {
            const result = await ping.promise.probe(ipAddress, {
                timeout: 10,
                extra: ['-c', '3']
            });

            return result;
        } catch (error) {
            console.error('Ping error:', error);
            return {
                host: ipAddress,
                alive: false,
            } as ping.PingResponse;
        }
    }

    async getCustomerInvoices(customerId: string): Promise<Invoice[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/clientes/${customerId}/facturas`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get customer invoices error:', error);
            return [];
        }
    }

    async getCustomerDebt(customerId: string): Promise<DebtInfo | null> {
        try {
            const invoicesResponse = await axios.get(`${config.wisphub.baseUrl}/clientes/${customerId}/facturas`, {
                headers: { 'Authorization': config.wisphub.apiKey },
                params: { estado: 'pendiente' }
            });

            const pendingInvoices = invoicesResponse.data.results || [];
            const totalDebt = pendingInvoices.reduce((sum: number, invoice: Invoice) => sum + invoice.monto, 0);

            // Obtener la próxima fecha de vencimiento
            let nextDueDate = new Date();
            if (pendingInvoices.length > 0) {
                // Ordenar facturas por fecha de vencimiento
                pendingInvoices.sort((a: Invoice, b: Invoice) => {
                    return new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
                });
                nextDueDate = new Date(pendingInvoices[0].fecha_vencimiento);
            }

            return {
                totalDebt,
                pendingInvoices: pendingInvoices.length,
                nextDueDate,
                overdueAmount: this.calculateOverdueAmount(pendingInvoices)
            };
        } catch (error) {
            console.error('Get customer debt error:', error);
            return null;
        }
    }

    private calculateOverdueAmount(invoices: Invoice[]): number {
        const today = new Date();
        return invoices
            .filter(invoice => new Date(invoice.fecha_vencimiento) < today)
            .reduce((sum, invoice) => sum + invoice.monto, 0);
    }

    async getCustomerPlan(customerId: string): Promise<PlanData | null> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/clientes/${customerId}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            if (!response.data || !response.data.plan) {
                return null;
            }

            return {
                id: response.data.plan.id,
                name: response.data.plan.nombre,
                speed: `${response.data.plan.velocidad_descarga}/${response.data.plan.velocidad_subida} Mbps`,
                price: response.data.plan.precio,
                description: response.data.plan.descripcion
            };
        } catch (error) {
            console.error('Get customer plan error:', error);
            return null;
        }
    }

    async getPaymentPoints(): Promise<PaymentPoint[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/puntos-pago`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get payment points error:', error);
            return [];
        }
    }

    async getOverdueCustomers(): Promise<OverdueCustomer[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/clientes/morosos`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get overdue customers error:', error);
            return [];
        }
    }

    async needsHumanAssistance(message: string): Promise<boolean> {
        const keywords = [
            'asesor',
            'agente',
            'humano',
            'persona'
        ];
        const messageNormalized = message.toLowerCase().trim();
        return keywords.some(keyword => messageNormalized.includes(keyword));
    }
}
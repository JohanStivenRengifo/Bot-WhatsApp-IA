// services/wisphubService.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class WisphubService {
    constructor() {
        const baseURL = process.env.NODE_ENV === 'production'
            ? 'https://api.wisphub.app'
            : 'https://sandbox-api.wisphub.net';

        this.apiClient = axios.create({
            baseURL,
            headers: {
                'Authorization': `Bearer ${config.wisphub.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 segundos timeout
        });
    }

    async getUserByCedula(cedula) {
        try {
            const response = await this.apiClient.get(`/v1/customers`, {
                params: {
                    document_number: cedula
                }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                const customer = response.data.data[0];
                return {
                    id: customer.id,
                    cedula: customer.document_number,
                    nombreCompleto: `${customer.first_name} ${customer.last_name}`.trim(),
                    email: customer.email,
                    direccion: customer.address,
                    telefono: customer.phone,
                    estado: customer.status,
                    servicios: customer.services || []
                };
            }
            return null;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            logger.error('Error consultando usuario en Wisphub:', error);
            throw new Error('Error al consultar información del usuario');
        }
    }

    async getServiciosCliente(customerId) {
        try {
            const response = await this.apiClient.get(`/v1/customers/${customerId}/services`);
            return response.data.data || [];
        } catch (error) {
            logger.error('Error consultando servicios del cliente:', error);
            return [];
        }
    }

    async getFacturasCliente(customerId, params = {}) {
        try {
            const response = await this.apiClient.get(`/v1/customers/${customerId}/invoices`, {
                params: {
                    status: params.status, // paid, unpaid, overdue
                    from_date: params.fromDate,
                    to_date: params.toDate,
                    ...params
                }
            });
            return response.data.data || [];
        } catch (error) {
            logger.error('Error consultando facturas del cliente:', error);
            return [];
        }
    }

    async registrarPago(customerId, data) {
        try {
            const response = await this.apiClient.post(`/v1/customers/${customerId}/payments`, {
                amount: data.amount,
                payment_method: data.paymentMethod,
                payment_date: data.paymentDate || new Date().toISOString(),
                reference: data.reference,
                notes: data.notes,
                invoice_ids: data.invoiceIds || []
            });
            return response.data;
        } catch (error) {
            logger.error('Error registrando pago:', error);
            throw new Error('Error al registrar el pago');
        }
    }

    async crearTicketSoporte(customerId, data) {
        try {
            const response = await this.apiClient.post(`/v1/tickets`, {
                customer_id: customerId,
                subject: data.subject,
                description: data.description,
                priority: data.priority || 'medium',
                category: data.category || 'technical',
                status: 'open'
            });
            return response.data;
        } catch (error) {
            logger.error('Error creando ticket de soporte:', error);
            throw new Error('Error al crear el ticket de soporte');
        }
    }

    async getTicketsCliente(customerId, params = {}) {
        try {
            const response = await this.apiClient.get(`/v1/customers/${customerId}/tickets`, {
                params: {
                    status: params.status, // open, closed, pending
                    priority: params.priority,
                    from_date: params.fromDate,
                    to_date: params.toDate,
                    ...params
                }
            });
            return response.data.data || [];
        } catch (error) {
            logger.error('Error consultando tickets del cliente:', error);
            return [];
        }
    }

    async actualizarTicket(ticketId, data) {
        try {
            const response = await this.apiClient.patch(`/v1/tickets/${ticketId}`, {
                status: data.status,
                priority: data.priority,
                notes: data.notes
            });
            return response.data;
        } catch (error) {
            logger.error('Error actualizando ticket:', error);
            throw new Error('Error al actualizar el ticket');
        }
    }

    async agregarComentarioTicket(ticketId, comment) {
        try {
            const response = await this.apiClient.post(`/v1/tickets/${ticketId}/comments`, {
                content: comment,
                is_public: true
            });
            return response.data;
        } catch (error) {
            logger.error('Error agregando comentario al ticket:', error);
            throw new Error('Error al agregar comentario al ticket');
        }
    }
}

module.exports = new WisphubService();

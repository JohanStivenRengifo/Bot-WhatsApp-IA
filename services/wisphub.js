/**
 * @file wisphub.js
 * @description Servicio mejorado para la integración con WispHub API
 * Incluye funcionalidades para autenticación, consulta de clientes, facturas y aplicación de acciones
 */

const axios = require('axios');
require('dotenv').config();
const logger = require('../utils/logger');

class WisphubService {
    /**
     * Constructor del servicio WispHub
     * @param {Object} config - Configuración opcional para sobreescribir valores por defecto
     */
    constructor(config = {}) {
        this.config = {
            apiKey: process.env.WISPHUB_API_KEY,
            baseUrl: process.env.NODE_ENV === 'production' ? 'https://api.wisphub.app' : 'https://sandbox-api.wisphub.net',
            companyId: process.env.WISPHUB_COMPANY_ID,
            companyUuid: process.env.WISPHUB_COMPANY_UUID,
            companySlug: process.env.WISPHUB_COMPANY_SLUG || 'conecta2tel',
            timeout: parseInt(process.env.WISPHUB_TIMEOUT || '30000', 10),
            debug: process.env.NODE_ENV === 'development',
            ...config
        };

        // Validar configuración mínima requerida
        if (!this.config.apiKey) {
            throw new Error('WISPHUB_API_KEY es requerido para el servicio WispHub');
        }

        // Crear instancia de axios con configuración base
        this.axiosInstance = axios.create({
            baseURL: `${this.config.baseUrl}/api`,
            timeout: this.config.timeout,
            headers: {
                'Authorization': `Api-Key ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Configurar interceptores para logging
        this.setupInterceptors();

        // Caché de sesiones para evitar múltiples autenticaciones
        this.sessions = new Map();
    }

    /**
     * Configura interceptores para logging de requests y responses
     */
    setupInterceptors() {
        // Interceptor de request
        this.axiosInstance.interceptors.request.use(request => {
            if (this.config.debug) {
                logger.debug(`WispHub API Request: ${request.method.toUpperCase()} ${request.url}`);
            }
            return request;
        }, error => {
            logger.error('WispHub API Request Error:', error);
            return Promise.reject(error);
        });

        // Interceptor de response
        this.axiosInstance.interceptors.response.use(response => {
            if (this.config.debug) {
                logger.debug(`WispHub API Response: ${response.status} ${response.statusText}`);
            }
            return response;
        }, error => {
            const errorData = {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            };
            logger.error('WispHub API Response Error:', errorData);
            return Promise.reject(error);
        });
    }

    /**
     * Obtiene una sesión válida o crea una nueva
     * @param {string} identifier - Identificador único para la sesión (ej: número de teléfono o ID de cliente)
     * @returns {Promise<Object>} Datos de la sesión
     */
    async getValidSession(identifier) {
        // Verificar si ya existe una sesión válida
        const existingSession = this.sessions.get(identifier);
        const now = Date.now();

        if (existingSession && existingSession.expiresAt > now) {
            return existingSession;
        }

        // Si no hay sesión válida, crear una nueva
        const session = {
            createdAt: now,
            expiresAt: now + (24 * 60 * 60 * 1000), // 24 horas de validez
            identifier
        };

        this.sessions.set(identifier, session);
        return session;
    }

    /**
     * Limpia la sesión de un usuario
     * @param {string} identifier - Identificador único de la sesión
     */
    clearSession(identifier) {
        this.sessions.delete(identifier);
    }

    /**
     * Autentica un usuario por su número de teléfono o documento de identidad
     * @param {string} identifier - Número de teléfono o documento de identidad
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Datos del usuario autenticado
     */
    async authenticateUser(identifier, options = {}) {
        try {
            // Intentar primero por número de teléfono
            let customer = await this.findCustomerByPhone(identifier);
            
            // Si no se encuentra, intentar por documento de identidad
            if (!customer && /^\d{6,12}$/.test(identifier)) {
                customer = await this.validateCustomer(identifier);
            }

            if (!customer || !customer.id) {
                return { success: false, message: 'Cliente no encontrado' };
            }

            // Crear o actualizar sesión
            const session = await this.getValidSession(identifier);
            session.customerId = customer.id;
            session.customerData = customer;

            return {
                success: true,
                ...customer,
                sessionId: session.identifier
            };
        } catch (error) {
            logger.error('Error en autenticación de usuario:', error);
            return { success: false, message: 'Error en autenticación', error: error.message };
        }
    }

    /**
     * Busca un cliente por su número de teléfono
     * @param {string} phoneNumber - Número de teléfono (con o sin prefijo internacional)
     * @returns {Promise<Object|null>} Datos del cliente o null si no se encuentra
     */
    async findCustomerByPhone(phoneNumber) {
        try {
            // Normalizar número de teléfono (eliminar prefijo internacional si existe)
            const normalizedPhone = phoneNumber.replace(/^\+?57/, '');
            
            // Buscar cliente por número de teléfono
            const response = await this.axiosInstance.get('/clientes/', {
                params: {
                    phone: normalizedPhone
                }
            });

            const customers = response.data?.data || [];
            
            if (customers.length === 0) {
                return null;
            }

            // Tomar el primer cliente que coincida
            const customer = customers[0];
            
            return this.formatCustomerData(customer);
        } catch (error) {
            logger.error('Error buscando cliente por teléfono:', error);
            return null;
        }
    }

    /**
     * Valida un cliente por su documento de identidad
     * @param {string} documentId - Documento de identidad del cliente
     * @returns {Promise<Object>} Datos del cliente validado
     */
    async validateCustomer(documentId) {
        try {
            const response = await this.axiosInstance.get('/clientes/', {
                params: {
                    document: documentId
                }
            });

            const customers = response.data?.data || [];
            
            if (customers.length === 0) {
                return { success: false, message: 'Cliente no encontrado' };
            }

            // Tomar el primer cliente que coincida
            const customer = customers[0];
            
            // Obtener facturas pendientes
            const invoices = await this.getCustomerInvoices(customer.id, { status: 'unpaid' });
            
            // Formatear datos del cliente
            const customerData = this.formatCustomerData(customer, invoices);
            
            return {
                success: true,
                ...customerData
            };
        } catch (error) {
            logger.error('Error validando cliente:', error);
            return { success: false, message: 'Error validando cliente', error: error.message };
        }
    }

    /**
     * Formatea los datos del cliente para uso interno
     * @param {Object} customer - Datos del cliente desde la API
     * @param {Array} invoices - Facturas del cliente (opcional)
     * @returns {Object} Datos del cliente formateados
     */
    formatCustomerData(customer, invoices = []) {
        return {
            id: customer.id,
            nombreCompleto: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
            email: customer.email,
            telefono: customer.phone,
            direccion: customer.address,
            estado: customer.status,
            facturasPendientes: invoices.length,
            plan: customer.plan_name || 'No especificado',
            fechaRegistro: customer.created_at,
            // Datos adicionales que pueden ser útiles
            documentoIdentidad: customer.document,
            tipoDocumento: customer.document_type,
            ciudad: customer.city,
            departamento: customer.state
        };
    }

    /**
     * Obtiene las facturas de un cliente
     * @param {string} customerId - ID del cliente
     * @param {Object} options - Opciones de filtrado (status, limit, etc)
     * @returns {Promise<Array>} Lista de facturas
     */
    async getCustomerInvoices(customerId, options = {}) {
        try {
            const params = {
                customer_id: customerId,
                ...options
            };

            const response = await this.axiosInstance.get('/facturas/', { params });
            return response.data.data || [];
        } catch (error) {
            logger.error('Error obteniendo facturas:', error);
            return [];
        }
    }

    /**
     * Obtiene el detalle de una factura específica
     * @param {string} invoiceId - ID de la factura
     * @returns {Promise<Object>} Detalle de la factura
     */
    async getInvoiceDetails(invoiceId) {
        try {
            const response = await this.axiosInstance.get(`/facturas/${invoiceId}/`);
            return response.data.data || null;
        } catch (error) {
            logger.error(`Error obteniendo detalle de factura ${invoiceId}:`, error);
            return null;
        }
    }

    /**
     * Registra un pago para una o más facturas
     * @param {string} customerId - ID del cliente
     * @param {Object} paymentData - Datos del pago
     * @returns {Promise<Object>} Resultado del registro de pago
     */
    async registrarPago(customerId, paymentData) {
        try {
            const data = {
                customer_id: customerId,
                ...paymentData
            };

            const response = await this.axiosInstance.post('/pagos/', data);
            return {
                success: true,
                data: response.data.data,
                message: 'Pago registrado exitosamente'
            };
        } catch (error) {
            logger.error('Error registrando pago:', error);
            return {
                success: false,
                message: 'Error al registrar el pago',
                error: error.message
            };
        }
    }

    /**
     * Envía un comprobante de pago
     * @param {string} paymentId - ID del pago
     * @param {Object} options - Opciones para el envío (email, whatsapp, etc)
     * @returns {Promise<Object>} Resultado del envío
     */
    async enviarComprobante(paymentId, options = {}) {
        try {
            const response = await this.axiosInstance.post(`/pagos/${paymentId}/comprobante/`, options);
            return {
                success: true,
                message: 'Comprobante enviado exitosamente',
                data: response.data
            };
        } catch (error) {
            logger.error('Error enviando comprobante:', error);
            return {
                success: false,
                message: 'Error al enviar comprobante',
                error: error.message
            };
        }
    }

    /**
     * Marca una factura como pagada
     * @param {string} invoiceId - ID de la factura
     * @param {Object} paymentData - Datos del pago
     * @returns {Promise<Object>} Resultado de la operación
     */
    async marcarFacturaPagada(invoiceId, paymentData) {
        try {
            const response = await this.axiosInstance.put(`/facturas/${invoiceId}/`, {
                status: 'paid',
                ...paymentData
            });
            
            return {
                success: true,
                message: 'Factura marcada como pagada',
                data: response.data.data
            };
        } catch (error) {
            logger.error('Error marcando factura como pagada:', error);
            return {
                success: false,
                message: 'Error al marcar factura como pagada',
                error: error.message
            };
        }
    }

    /**
     * Obtiene el estado del servicio de un cliente
     * @param {string} customerId - ID del cliente
     * @returns {Promise<Object>} Estado del servicio
     */
    async getServiceStatus(customerId) {
        try {
            const response = await this.axiosInstance.get(`/clientes/${customerId}/`);
            const customerData = response.data.data || {};
            
            // Extraer información relevante del estado del servicio
            return {
                success: true,
                status: customerData.status,
                plan: customerData.plan_name,
                velocidad: customerData.plan_speed,
                fechaActivacion: customerData.activation_date,
                fechaVencimiento: customerData.expiration_date,
                direccionServicio: customerData.service_address || customerData.address,
                equipos: customerData.equipments || []
            };
        } catch (error) {
            logger.error('Error obteniendo estado del servicio:', error);
            return {
                success: false,
                message: 'Error al obtener estado del servicio',
                error: error.message
            };
        }
    }

    /**
     * Crea un ticket de soporte técnico
     * @param {Object} ticketData - Datos del ticket
     * @returns {Promise<Object>} Ticket creado
     */
    async createSupportTicket(ticketData) {
        try {
            const response = await this.axiosInstance.post('/tickets/', ticketData);
            return {
                success: true,
                message: 'Ticket creado exitosamente',
                data: response.data.data
            };
        } catch (error) {
            logger.error('Error creando ticket de soporte:', error);
            return {
                success: false,
                message: 'Error al crear ticket de soporte',
                error: error.message
            };
        }
    }

    /**
     * Obtiene los tickets de soporte de un cliente
     * @param {string} customerId - ID del cliente
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de tickets
     */
    async getCustomerTickets(customerId, options = {}) {
        try {
            const params = {
                customer_id: customerId,
                ...options
            };

            const response = await this.axiosInstance.get('/tickets/', { params });
            return response.data.data || [];
        } catch (error) {
            logger.error('Error obteniendo tickets:', error);
            return [];
        }
    }
}

module.exports = WisphubService;
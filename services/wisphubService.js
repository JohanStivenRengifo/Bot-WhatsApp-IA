// services/wisphubService.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const User = require('../models/User');

class WisphubService {
    constructor() {
        const baseHost = config.wisphub.useSandbox ? config.wisphub.sandboxUrl : config.wisphub.baseUrl;
        this.baseUrl = `${baseHost}/api`;  // Agregamos /api/ a la URL base
        this.apiKey = config.wisphub.apiKey;
        this.timeout = config.wisphub.timeout;
        this.companyId = config.wisphub.companyId;
        this.companyUuid = config.wisphub.companyUuid;

        if (!this.apiKey || !this.baseUrl) {
            logger.error('❌ Error: Falta configuración de Wisphub');
            throw new Error('Configuración de Wisphub incompleta');
        }

        // Log de configuración inicial
        logger.info('Inicializando WisphubService:', {
            baseUrl: this.baseUrl,
            companyId: this.companyId,
            timeout: this.timeout
        });

        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Api-Key ${this.apiKey}`  // Agregamos el prefijo Api-Key aquí
            }
        });

        // Interceptor para logging
        this.axiosInstance.interceptors.request.use(request => {
            logger.info('Enviando petición a Wisphub:', {
                method: request.method,
                url: request.url,
                params: request.params
            });
            return request;
        });

        this.axiosInstance.interceptors.response.use(
            response => response,
            error => {
                logger.error('Error en petición a Wisphub:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    config: {
                        method: error.config?.method,
                        url: error.config?.url,
                        params: error.config?.params,
                        headers: error.config?.headers
                    }
                });
                throw error;
            }
        );
    }

    /**
     * Autentica un usuario en Wisphub
     * @param {string} phoneNumber - Número de teléfono del usuario
     * @returns {Promise<Object>} Resultado de la autenticación
     */
    async authenticateUser(phoneNumber) {
        try {
            // Verificar si ya existe una sesión válida
            const existingSession = this.getValidSession(phoneNumber);
            if (existingSession) {
                logger.info('✅ Sesión existente encontrada', { phoneNumber });
                return {
                    success: true,
                    session: existingSession
                };
            }

            // Obtener usuario de la base de datos
            const user = await User.findOne({ phoneNumber });
            if (!user) {
                throw new Error('Usuario no encontrado');
            }            // Autenticar con Wisphub
            const response = await this.axiosInstance.post('/_/', {
                phone: phoneNumber
            });

            if (!response.data.success) {
                throw new Error(response.data.message || 'Error en la autenticación');
            }

            // Crear nueva sesión
            const session = {
                token: response.data.token,
                expiresAt: Date.now() + this.sessionTimeout,
                userData: {
                    id: user._id,
                    phoneNumber: user.phoneNumber,
                    name: user.name
                }
            };

            // Guardar sesión
            this.sessions.set(phoneNumber, session);

            // Programar limpieza de sesión
            setTimeout(() => this.clearSession(phoneNumber), this.sessionTimeout);

            logger.info('✅ Usuario autenticado exitosamente', { phoneNumber });

            return {
                success: true,
                session
            };
        } catch (error) {
            logger.error('❌ Error en autenticación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }    /**
     * Verifica si una sesión es válida
     * @param {string} phoneNumber - Número de teléfono
     * @returns {Object|null} Sesión válida o null
     */
    getValidSession(phoneNumber) {
        const session = this.sessions.get(phoneNumber);
        if (!session) return null;

        if (Date.now() > session.expiresAt) {
            this.clearSession(phoneNumber);
            return null;
        }

        return session;
    }

    /**
     * Verifica y obtiene los datos de un cliente por su cédula
     * @param {string} cedula - Número de cédula del cliente
     * @returns {Promise<Object>} Datos del cliente o error
     */
    async validateCustomer(cedula) {
        try {
            logger.info('Buscando cliente en Wisphub:', { cedula });

            // Endpoint correcto según documentación de Wisphub
            const searchResponse = await this.axiosInstance.get('/clientes/', {
                params: {
                    identification: cedula,
                    include: 'plans,invoices'
                }
            });

            if (!searchResponse.data?.data || searchResponse.data.data.length === 0) {
                logger.info('Cliente no encontrado en Wisphub:', { cedula });
                return {
                    success: false,
                    error: 'Cliente no encontrado'
                };
            }

            const customer = searchResponse.data.data[0];

            // Filtrar facturas pendientes
            const pendingInvoices = (customer.invoices || []).filter(invoice =>
                invoice.status === 'pending' || invoice.status === 'overdue'
            );

            return {
                success: true,
                nombreCompleto: `${customer.first_name} ${customer.last_name}`.trim(),
                cedula: customer.identification,
                email: customer.email,
                telefono: customer.phone,
                direccion: customer.address,
                customerId: customer.id,
                estado: customer.status,
                facturasPendientes: pendingInvoices,
                plan: customer.plans?.[0]?.name || 'Sin plan asignado'
            };

        } catch (error) {
            logger.error('Error validando cliente en Wisphub:', {
                error: error.message,
                cedula,
                stack: error.stack,
                response: error.response?.data
            });

            return {
                success: false,
                error: 'Error al validar el cliente'
            };
        }
    }

    /**
     * Obtiene las facturas pendientes de un cliente
     * @param {string} customerId - ID del cliente en Wisphub
     * @returns {Promise<Array>} Lista de facturas pendientes
     */
    async getCustomerInvoices(customerId) {
        try {
            const response = await this.axiosInstance.get(`/facturas/`, {
                params: {
                    customer_id: customerId
                }
            });
            return response.data.data || [];
        } catch (error) {
            logger.error('Error obteniendo facturas:', error);
            throw error;
        }
    }

    /**
     * Obtiene el estado del servicio de un cliente
     * @param {string} customerId - ID del cliente en Wisphub
     * @returns {Promise<Object>} Estado del servicio
     */
    async getServiceStatus(customerId) {
        try {
            const response = await this.axiosInstance.get(`/clientes/${customerId}/`);
            return response.data.data || [];
        } catch (error) {
            logger.error('Error obteniendo estado del servicio:', error);
            throw error;
        }
    }

    /**
     * Registra un ticket de soporte
     * @param {Object} ticketData - Datos del ticket
     * @returns {Promise<Object>} Ticket creado
     */
    async createSupportTicket(ticketData) {
        try {
            const response = await this.axiosInstance.post('/tickets/', {
                ...ticketData
            });
            return response.data;
        } catch (error) {
            logger.error('Error creando ticket de soporte:', error);
            throw error;
        }
    }
}

module.exports = WisphubService;
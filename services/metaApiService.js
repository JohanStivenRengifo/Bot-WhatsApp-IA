// services/metaApiService.js
const axios = require('axios');
const config = require('../config');
const { MetaApiErrorHandler } = require('../utils/metaApiUtils');
const logger = require('../utils/logger');

class MetaApiService {
    constructor() {
        this.baseUrl = config.meta.baseUrl;
        this.apiVersion = config.meta.apiVersion;
        this.numberId = config.meta.numberId;
        this.token = config.meta.jwtToken;
        this.businessAccountId = config.meta.businessAccountId;
        this.apiUrl = `${this.baseUrl}/${this.apiVersion}/${this.numberId}/messages`;
        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async makeRequest(method, endpoint, data = null, retryCount = 0) {
        try {
            const url = endpoint === 'messages' ? this.apiUrl : `${this.baseUrl}/${this.apiVersion}/${endpoint}`;

            const requestConfig = {
                method,
                url,
                data: data || undefined
            };

            logger.debug('🔄 Petición a Meta API', {
                method,
                url,
                data: data ? JSON.stringify(data) : undefined
            });

            const response = await this.axiosInstance(requestConfig);

            logger.debug('✅ Respuesta de Meta API', {
                status: response.status,
                data: response.data
            });

            return response.data;
        } catch (error) {
            const shouldRetry = this.shouldRetryRequest(error, retryCount);

            if (shouldRetry) {
                const delay = this.calculateRetryDelay(retryCount);
                logger.warn(`Reintentando petición después de ${delay}ms (intento ${retryCount + 1}/${config.retry.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.makeRequest(method, endpoint, data, retryCount + 1);
            }

            logger.error('❌ Error en petición a Meta API', {
                error: error.response?.data || error.message,
                url: error.config?.url,
                status: error.response?.status
            });

            throw MetaApiErrorHandler.handleMetaApiError(error);
        }
    }

    shouldRetryRequest(error, retryCount) {
        if (retryCount >= config.retry.maxRetries) return false;

        const status = error.response?.status;
        return status === 429 || status === 500 || status === 503 || status === 504;
    }

    calculateRetryDelay(retryCount) {
        return Math.min(
            config.retry.delay * Math.pow(config.retry.backoffFactor, retryCount),
            30000 // máximo 30 segundos
        );
    }

    async sendTextMessage(to, text, options = {}) {
        const data = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'text',
            text: {
                preview_url: options.previewUrl || false,
                body: text
            }
        };

        try {
            logger.info('📤 Enviando mensaje de texto', {
                to,
                messagePreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
            });

            const response = await this.makeRequest('POST', 'messages', data);

            logger.info('✅ Mensaje enviado exitosamente', {
                to,
                messageId: response.messages?.[0]?.id
            });

            return response;
        } catch (error) {
            logger.error('❌ Error enviando mensaje de texto', {
                to,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async sendInteractiveMessage(to, messageData) {
        try {
            const data = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'interactive',
                interactive: {
                    type: messageData.type,
                    header: messageData.header,
                    body: messageData.body,
                    action: messageData.action,
                    footer: messageData.footer
                }
            };

            logger.info('📤 Enviando mensaje interactivo', {
                to,
                type: messageData.type
            });

            const response = await this.makeRequest('POST', 'messages', data);

            logger.info('✅ Mensaje interactivo enviado exitosamente', {
                to,
                messageId: response.messages?.[0]?.id
            });

            return response;
        } catch (error) {
            logger.error('❌ Error enviando mensaje interactivo', {
                to,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async sendTemplateMessage(to, templateName, languageCode, components = []) {
        try {
            const data = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    },
                    components: components
                }
            };

            logger.info('📤 Enviando mensaje de plantilla', {
                to,
                templateName,
                languageCode
            });

            const response = await this.makeRequest('POST', 'messages', data);

            logger.info('✅ Mensaje de plantilla enviado exitosamente', {
                to,
                messageId: response.messages?.[0]?.id
            });

            return response;
        } catch (error) {
            logger.error('❌ Error enviando mensaje de plantilla', {
                to,
                templateName,
                error: error.message
            });
            throw error;
        }
    }

    async sendMediaMessage(to, mediaType, mediaUrl, caption = '') {
        try {
            const data = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: mediaType,
                [mediaType]: {
                    link: mediaUrl,
                    caption: caption
                }
            };

            logger.info('📤 Enviando mensaje multimedia', {
                to,
                mediaType,
                mediaUrl
            });

            const response = await this.makeRequest('POST', 'messages', data);

            logger.info('✅ Mensaje multimedia enviado exitosamente', {
                to,
                messageId: response.messages?.[0]?.id
            });

            return response;
        } catch (error) {
            logger.error('❌ Error enviando mensaje multimedia', {
                to,
                mediaType,
                error: error.message
            });
            throw error;
        }
    }

    async setupWebhook() {
        try {
            const webhookUrl = config.app.webhookUrl;
            const verifyToken = config.meta.verifyToken;

            const data = {
                url: webhookUrl,
                verify_token: verifyToken,
                fields: config.meta.webhookFields
            };

            logger.info('🔄 Configurando webhook de WhatsApp', {
                url: webhookUrl
            });

            const response = await this.makeRequest('POST', `${this.businessAccountId}/webhooks`, data);

            logger.info('✅ Webhook configurado exitosamente', {
                webhookId: response.id
            });

            return response;
        } catch (error) {
            logger.error('❌ Error configurando webhook', {
                error: error.message
            });
            throw error;
        }
    }

    async verifyConnection() {
        try {
            logger.info('🔄 Verificando conexión con la API de Meta...');

            const [tokenStatus, businessProfile] = await Promise.all([
                this.verifyTokenStatus(),
                this.getBusinessProfile()
            ]);

            if (tokenStatus.valid) {
                logger.info('✅ Conexión con la API de Meta verificada exitosamente', {
                    businessProfile: businessProfile.name
                });
                return true;
            } else {
                logger.error('❌ Error verificando conexión con la API de Meta: Token inválido');
                throw new Error('Token de API de Meta inválido o expirado');
            }
        } catch (error) {
            logger.error('❌ Error verificando conexión con la API de Meta:', error);
            throw error;
        }
    }

    async verifyTokenStatus() {
        try {
            logger.info('🔄 Verificando estado del token de la API de Meta...');

            const response = await this.makeRequest('GET', `${this.numberId}/whatsapp_business_profile`);

            return {
                valid: true,
                expiresAt: null,
                profile: response
            };
        } catch (error) {
            if (error.message.includes('Token de acceso no válido') ||
                error.message.includes('Error de autenticación')) {
                logger.error('❌ Token de API de Meta inválido o expirado');
                return {
                    valid: false,
                    error: error.message
                };
            }

            logger.error('❌ Error verificando estado del token:', error);
            throw error;
        }
    }

    async getBusinessProfile() {
        try {
            const response = await this.makeRequest('GET', `${this.numberId}/whatsapp_business_profile`);
            return response;
        } catch (error) {
            logger.error('❌ Error obteniendo perfil de negocio:', error);
            throw error;
        }
    }

    async getMessageTemplates() {
        try {
            const response = await this.makeRequest('GET', `${this.businessAccountId}/message_templates`);
            return response.data;
        } catch (error) {
            logger.error('❌ Error obteniendo plantillas de mensajes:', error);
            throw error;
        }
    }
}

module.exports = new MetaApiService();
// services/whatsappService.js
const { BotUtils } = require('../utils/botUtils');
const logger = require('../utils/logger');
const metaApiService = require('./metaApiService');

class WhatsappService {
    constructor() {
        this.metaApiService = require('./metaApiService');
    }

    /**
     * Envía un mensaje de texto
     * @param {string} to - Número de teléfono del destinatario
     * @param {string} body - Mensaje a enviar
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendTextMessage(to, body) {
        if (!body || typeof body !== 'string' || !body.trim()) {
            throw new Error('El mensaje de texto no puede estar vacío');
        }
        const data = {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body }
        };
        return metaApiService.sendMessage(data);
    }

    /**
     * Envía un mensaje interactivo con botones
     * @param {string} to - Número de teléfono del destinatario
     * @param {Object} interactive - Objeto que representa el mensaje interactivo
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendInteractiveMessage(to, interactive) {
        // Validar estructura mínima
        if (!interactive || !interactive.type || !interactive.body) {
            throw new Error('Mensaje interactivo mal formado');
        }
        const data = {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive
        };
        return metaApiService.sendMessage(data);
    }

    /**
     * Envía un mensaje con lista de opciones
     * @param {string} to - Número de teléfono del destinatario
     * @param {string} header - Encabezado del mensaje
     * @param {string} body - Cuerpo del mensaje
     * @param {string} buttonText - Texto del botón de la lista
     * @param {Array<Object>} sections - Secciones de la lista
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendListMessage(to, header, body, buttonText, sections) {
        try {
            const data = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: {
                        type: 'text',
                        text: header
                    },
                    body: {
                        text: body
                    },
                    action: {
                        button: buttonText,
                        sections: sections
                    }
                }
            };

            // Normalizar número de teléfono si es necesario
            const formattedNumber = BotUtils.formatPhoneNumber(to);

            logger.info('📤 Enviando mensaje de lista', {
                to: formattedNumber,
                header,
                bodyPreview: body.substring(0, 50) + (body.length > 50 ? '...' : ''),
                buttonText,
                sections: sections.map(s => ({
                    title: s.title,
                    items: s.rows.length
                })),
                type: 'list'
            });

            // Enviar mensaje a través del servicio de Meta API
            const response = await this.metaApiService.sendInteractiveMessage(formattedNumber, data);

            logger.info('✅ Mensaje de lista enviado exitosamente', {
                to: formattedNumber,
                messageId: response.messages?.[0]?.id
            });

            return response;
        } catch (error) {
            logger.error('❌ Error enviando mensaje de lista', {
                to,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Envía un mensaje plantilla
     * @param {string} to - Número de teléfono del destinatario
     * @param {Object} template - Objeto que representa la plantilla
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendTemplateMessage(to, template) {
        // Validar estructura mínima
        if (!template || !template.name || !template.language) {
            throw new Error('Plantilla mal formada');
        }
        const data = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template
        };
        return metaApiService.sendMessage(data);
    }

    /**
     * Verifica el estado del token
     * @returns {Promise<Object>} - Estado del token
     */
    async verifyTokenStatus() {
        return await this.metaApiService.verifyTokenStatus();
    }
}

module.exports = new WhatsappService();
const logger = require('../utils/logger');
const metaApiService = require('./metaApiService');
const flowService = require('./flowService');
const userService = require('./userService');
const templateService = require('./templateService');

class MessageHandler {
    /**
     * Maneja un mensaje de texto
     * @param {Object} message - Objeto del mensaje
     * @param {Object} contact - Información del contacto
     * @param {Object} metadata - Metadatos del mensaje
     */
    async handleTextMessage(message, contact, metadata) {
        try {
            const { from, text } = message;
            const user = await userService.getOrCreateUser(from, contact);

            logger.info('📝 Procesando mensaje de texto', {
                from,
                text: text.body,
                userId: user._id
            });

            // Determinar el flujo actual del usuario
            const currentFlow = await flowService.getCurrentFlow(user._id);

            // Procesar el mensaje según el flujo actual
            const response = await flowService.processMessage(currentFlow, text.body, user);

            // Enviar respuesta
            if (response) {
                await this.sendResponse(from, response, user);
            }
        } catch (error) {
            logger.error('❌ Error procesando mensaje de texto:', error);
            await this.handleError(message.from, error);
        }
    }

    /**
     * Maneja un mensaje interactivo
     * @param {Object} message - Objeto del mensaje
     * @param {Object} contact - Información del contacto
     * @param {Object} metadata - Metadatos del mensaje
     */
    async handleInteractiveMessage(message, contact, metadata) {
        try {
            const { from, interactive } = message;
            const user = await userService.getOrCreateUser(from, contact);

            logger.info('🔄 Procesando mensaje interactivo', {
                from,
                type: interactive.type,
                userId: user._id
            });

            // Obtener la respuesta del mensaje interactivo
            const response = await this.getInteractiveResponse(interactive, user);

            // Enviar respuesta
            if (response) {
                await this.sendResponse(from, response, user);
            }
        } catch (error) {
            logger.error('❌ Error procesando mensaje interactivo:', error);
            await this.handleError(message.from, error);
        }
    }

    /**
     * Maneja un mensaje multimedia
     * @param {Object} message - Objeto del mensaje
     * @param {Object} contact - Información del contacto
     * @param {Object} metadata - Metadatos del mensaje
     */
    async handleMediaMessage(message, contact, metadata) {
        try {
            const { from, type, [type]: media } = message;
            const user = await userService.getOrCreateUser(from, contact);

            logger.info('📎 Procesando mensaje multimedia', {
                from,
                type,
                mediaId: media.id,
                userId: user._id
            });

            // Guardar la referencia del medio en la base de datos
            await userService.saveMediaReference(user._id, {
                type,
                mediaId: media.id,
                timestamp: message.timestamp
            });

            // Enviar confirmación de recepción
            await this.sendMediaConfirmation(from, type);
        } catch (error) {
            logger.error('❌ Error procesando mensaje multimedia:', error);
            await this.handleError(message.from, error);
        }
    }

    /**
     * Maneja un mensaje de ubicación
     * @param {Object} message - Objeto del mensaje
     * @param {Object} contact - Información del contacto
     * @param {Object} metadata - Metadatos del mensaje
     */
    async handleLocationMessage(message, contact, metadata) {
        try {
            const { from, location } = message;
            const user = await userService.getOrCreateUser(from, contact);

            logger.info('📍 Procesando mensaje de ubicación', {
                from,
                latitude: location.latitude,
                longitude: location.longitude,
                userId: user._id
            });

            // Guardar la ubicación en la base de datos
            await userService.saveLocation(user._id, {
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: message.timestamp
            });

            // Enviar confirmación de recepción
            await this.sendLocationConfirmation(from);
        } catch (error) {
            logger.error('❌ Error procesando mensaje de ubicación:', error);
            await this.handleError(message.from, error);
        }
    }

    /**
     * Maneja un mensaje de contactos
     * @param {Object} message - Objeto del mensaje
     * @param {Object} contact - Información del contacto
     * @param {Object} metadata - Metadatos del mensaje
     */
    async handleContactsMessage(message, contact, metadata) {
        try {
            const { from, contacts } = message;
            const user = await userService.getOrCreateUser(from, contact);

            logger.info('👥 Procesando mensaje de contactos', {
                from,
                contactCount: contacts.length,
                userId: user._id
            });

            // Guardar los contactos en la base de datos
            await userService.saveContacts(user._id, contacts);

            // Enviar confirmación de recepción
            await this.sendContactsConfirmation(from, contacts.length);
        } catch (error) {
            logger.error('❌ Error procesando mensaje de contactos:', error);
            await this.handleError(message.from, error);
        }
    }

    /**
     * Actualiza el estado de un mensaje
     * @param {Object} status - Estado del mensaje
     */
    async updateMessageStatus(status) {
        try {
            const { id, status: messageStatus, timestamp } = status;

            logger.info('📨 Actualizando estado de mensaje', {
                messageId: id,
                status: messageStatus,
                timestamp
            });

            // Actualizar el estado en la base de datos
            await userService.updateMessageStatus(id, messageStatus, timestamp);
        } catch (error) {
            logger.error('❌ Error actualizando estado de mensaje:', error);
        }
    }

    /**
     * Actualiza el estado de lectura de un mensaje
     * @param {Object} status - Estado de lectura del mensaje
     */
    async updateMessageReadStatus(status) {
        try {
            const { id, timestamp } = status;

            logger.info('👁️ Actualizando estado de lectura de mensaje', {
                messageId: id,
                timestamp
            });

            // Actualizar el estado de lectura en la base de datos
            await userService.updateMessageReadStatus(id, timestamp);
        } catch (error) {
            logger.error('❌ Error actualizando estado de lectura de mensaje:', error);
        }
    }

    /**
     * Actualiza el estado de una plantilla
     * @param {string} templateId - ID de la plantilla
     * @param {string} event - Evento de actualización
     */
    async updateTemplateStatus(templateId, event) {
        try {
            logger.info('📝 Actualizando estado de plantilla', {
                templateId,
                event
            });

            // Actualizar el estado de la plantilla en la base de datos
            await templateService.updateTemplateStatus(templateId, event);
        } catch (error) {
            logger.error('❌ Error actualizando estado de plantilla:', error);
        }
    }

    /**
     * Obtiene la respuesta para un mensaje interactivo
     * @param {Object} interactive - Datos del mensaje interactivo
     * @param {Object} user - Usuario que envió el mensaje
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async getInteractiveResponse(interactive, user) {
        const { type } = interactive;

        switch (type) {
            case 'button_reply':
                return await this.handleButtonReply(interactive.button_reply, user);
            case 'list_reply':
                return await this.handleListReply(interactive.list_reply, user);
            default:
                logger.warn('⚠️ Tipo de respuesta interactiva no manejada', { type });
                return null;
        }
    }

    /**
     * Maneja una respuesta de botón
     * @param {Object} buttonReply - Datos de la respuesta del botón
     * @param {Object} user - Usuario que envió el mensaje
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async handleButtonReply(buttonReply, user) {
        const { id, title } = buttonReply;
        const currentFlow = await flowService.getCurrentFlow(user._id);
        return await flowService.processButtonResponse(currentFlow, id, title, user);
    }

    /**
     * Maneja una respuesta de lista
     * @param {Object} listReply - Datos de la respuesta de la lista
     * @param {Object} user - Usuario que envió el mensaje
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async handleListReply(listReply, user) {
        const { id, title, description } = listReply;
        const currentFlow = await flowService.getCurrentFlow(user._id);
        return await flowService.processListResponse(currentFlow, id, title, description, user);
    }

    /**
     * Envía una respuesta al usuario
     * @param {string} to - Número de teléfono del destinatario
     * @param {Object} response - Respuesta a enviar
     * @param {Object} user - Usuario que recibirá la respuesta
     */
    async sendResponse(to, response, user) {
        try {
            const { type, content } = response;

            switch (type) {
                case 'text':
                    await metaApiService.sendTextMessage(to, content);
                    break;
                case 'template':
                    await metaApiService.sendTemplateMessage(to, content.name, content.language, content.components);
                    break;
                case 'interactive':
                    await metaApiService.sendInteractiveMessage(to, content);
                    break;
                case 'media':
                    await metaApiService.sendMediaMessage(to, content.type, content.url, content.caption);
                    break;
                default:
                    logger.warn('⚠️ Tipo de respuesta no manejado', { type });
            }

            // Guardar la respuesta en la base de datos
            await userService.saveResponse(user._id, response);
        } catch (error) {
            logger.error('❌ Error enviando respuesta:', error);
            await this.handleError(to, error);
        }
    }

    /**
     * Maneja un error enviando un mensaje al usuario
     * @param {string} to - Número de teléfono del destinatario
     * @param {Error} error - Error ocurrido
     */
    async handleError(to, error) {
        try {
            const errorMessage = 'Lo siento, ha ocurrido un error. Por favor, intente de nuevo más tarde.';
            await metaApiService.sendTextMessage(to, errorMessage);
        } catch (sendError) {
            logger.error('❌ Error enviando mensaje de error:', sendError);
        }
    }

    /**
     * Envía confirmación de recepción de medio
     * @param {string} to - Número de teléfono del destinatario
     * @param {string} type - Tipo de medio
     */
    async sendMediaConfirmation(to, type) {
        const confirmations = {
            image: 'He recibido tu imagen.',
            video: 'He recibido tu video.',
            audio: 'He recibido tu audio.',
            document: 'He recibido tu documento.'
        };

        const message = confirmations[type] || 'He recibido tu archivo.';
        await metaApiService.sendTextMessage(to, message);
    }

    /**
     * Envía confirmación de recepción de ubicación
     * @param {string} to - Número de teléfono del destinatario
     */
    async sendLocationConfirmation(to) {
        await metaApiService.sendTextMessage(to, 'He recibido tu ubicación.');
    }

    /**
     * Envía confirmación de recepción de contactos
     * @param {string} to - Número de teléfono del destinatario
     * @param {number} count - Cantidad de contactos recibidos
     */
    async sendContactsConfirmation(to, count) {
        const message = count === 1
            ? 'He recibido tu contacto.'
            : `He recibido tus ${count} contactos.`;
        await metaApiService.sendTextMessage(to, message);
    }
}

module.exports = new MessageHandler(); 
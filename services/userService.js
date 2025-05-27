const logger = require('../utils/logger');
const User = require('../models/User');
const Message = require('../models/Message');

class UserService {
    /**
     * Obtiene o crea un usuario
     * @param {string} phoneNumber - Número de teléfono del usuario
     * @param {Object} contact - Información del contacto
     * @returns {Promise<Object>} Usuario encontrado o creado
     */
    async getOrCreateUser(phoneNumber, contact) {
        try {
            let user = await User.findOne({ phoneNumber });

            if (!user) {
                logger.info('👤 Creando nuevo usuario', {
                    phoneNumber,
                    name: contact?.profile?.name
                });

                user = await User.create({
                    phoneNumber,
                    name: contact?.profile?.name,
                    currentFlow: 'welcome',
                    currentStep: 'greeting',
                    lastInteraction: new Date()
                });
            } else {
                // Actualizar información del usuario si es necesario
                if (contact?.profile?.name && user.name !== contact.profile.name) {
                    user.name = contact.profile.name;
                    await user.save();
                }

                // Actualizar última interacción
                user.lastInteraction = new Date();
                await user.save();
            }

            return user;
        } catch (error) {
            logger.error('❌ Error obteniendo/creando usuario:', error);
            throw error;
        }
    }

    /**
     * Obtiene un usuario por su ID
     * @param {string} userId - ID del usuario
     * @returns {Promise<Object>} Usuario encontrado
     */
    async getUser(userId) {
        try {
            const user = await User.findById(userId);

            if (!user) {
                logger.error('❌ Usuario no encontrado', { userId });
                throw new Error('Usuario no encontrado');
            }

            return user;
        } catch (error) {
            logger.error('❌ Error obteniendo usuario:', error);
            throw error;
        }
    }

    /**
     * Actualiza el flujo actual de un usuario
     * @param {string} userId - ID del usuario
     * @param {string} flowId - ID del flujo
     * @param {string} stepId - ID del paso
     * @returns {Promise<Object>} Usuario actualizado
     */
    async updateUserFlow(userId, flowId, stepId) {
        try {
            const user = await this.getUser(userId);

            user.currentFlow = flowId;
            user.currentStep = stepId;
            user.lastInteraction = new Date();

            await user.save();

            logger.info('✅ Flujo de usuario actualizado', {
                userId,
                flowId,
                stepId
            });

            return user;
        } catch (error) {
            logger.error('❌ Error actualizando flujo de usuario:', error);
            throw error;
        }
    }

    /**
     * Guarda una referencia de medio
     * @param {string} userId - ID del usuario
     * @param {Object} mediaData - Datos del medio
     * @returns {Promise<Object>} Referencia guardada
     */
    async saveMediaReference(userId, mediaData) {
        try {
            const { type, mediaId, timestamp } = mediaData;

            const media = await Message.create({
                userId,
                type: 'media',
                mediaType: type,
                mediaId,
                timestamp: new Date(timestamp * 1000)
            });

            logger.info('✅ Referencia de medio guardada', {
                userId,
                mediaId,
                type
            });

            return media;
        } catch (error) {
            logger.error('❌ Error guardando referencia de medio:', error);
            throw error;
        }
    }

    /**
     * Guarda una ubicación
     * @param {string} userId - ID del usuario
     * @param {Object} locationData - Datos de la ubicación
     * @returns {Promise<Object>} Ubicación guardada
     */
    async saveLocation(userId, locationData) {
        try {
            const { latitude, longitude, timestamp } = locationData;

            const location = await Message.create({
                userId,
                type: 'location',
                latitude,
                longitude,
                timestamp: new Date(timestamp * 1000)
            });

            logger.info('✅ Ubicación guardada', {
                userId,
                latitude,
                longitude
            });

            return location;
        } catch (error) {
            logger.error('❌ Error guardando ubicación:', error);
            throw error;
        }
    }

    /**
     * Guarda contactos
     * @param {string} userId - ID del usuario
     * @param {Array} contacts - Lista de contactos
     * @returns {Promise<Object>} Contactos guardados
     */
    async saveContacts(userId, contacts) {
        try {
            const savedContacts = await Message.create({
                userId,
                type: 'contacts',
                contacts,
                timestamp: new Date()
            });

            logger.info('✅ Contactos guardados', {
                userId,
                contactCount: contacts.length
            });

            return savedContacts;
        } catch (error) {
            logger.error('❌ Error guardando contactos:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado de un mensaje
     * @param {string} messageId - ID del mensaje
     * @param {string} status - Nuevo estado
     * @param {number} timestamp - Timestamp del evento
     * @returns {Promise<Object>} Mensaje actualizado
     */
    async updateMessageStatus(messageId, status, timestamp) {
        try {
            const message = await Message.findOneAndUpdate(
                { messageId },
                {
                    status,
                    statusTimestamp: new Date(timestamp * 1000)
                },
                { new: true }
            );

            if (!message) {
                logger.warn('⚠️ Mensaje no encontrado para actualizar estado', {
                    messageId
                });
                return null;
            }

            logger.info('✅ Estado de mensaje actualizado', {
                messageId,
                status
            });

            return message;
        } catch (error) {
            logger.error('❌ Error actualizando estado de mensaje:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado de lectura de un mensaje
     * @param {string} messageId - ID del mensaje
     * @param {number} timestamp - Timestamp del evento
     * @returns {Promise<Object>} Mensaje actualizado
     */
    async updateMessageReadStatus(messageId, timestamp) {
        try {
            const message = await Message.findOneAndUpdate(
                { messageId },
                {
                    read: true,
                    readTimestamp: new Date(timestamp * 1000)
                },
                { new: true }
            );

            if (!message) {
                logger.warn('⚠️ Mensaje no encontrado para actualizar estado de lectura', {
                    messageId
                });
                return null;
            }

            logger.info('✅ Estado de lectura de mensaje actualizado', {
                messageId
            });

            return message;
        } catch (error) {
            logger.error('❌ Error actualizando estado de lectura de mensaje:', error);
            throw error;
        }
    }

    /**
     * Guarda una respuesta enviada
     * @param {string} userId - ID del usuario
     * @param {Object} response - Respuesta enviada
     * @returns {Promise<Object>} Respuesta guardada
     */
    async saveResponse(userId, response) {
        try {
            const { type, content } = response;

            const message = await Message.create({
                userId,
                type: 'outgoing',
                messageType: type,
                content,
                timestamp: new Date()
            });

            logger.info('✅ Respuesta guardada', {
                userId,
                type
            });

            return message;
        } catch (error) {
            logger.error('❌ Error guardando respuesta:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial de mensajes de un usuario
     * @param {string} userId - ID del usuario
     * @param {Object} options - Opciones de paginación
     * @returns {Promise<Object>} Historial de mensajes
     */
    async getMessageHistory(userId, options = {}) {
        try {
            const { limit = 50, skip = 0 } = options;

            const messages = await Message.find({ userId })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Message.countDocuments({ userId });

            logger.info('📜 Historial de mensajes obtenido', {
                userId,
                count: messages.length,
                total
            });

            return {
                messages,
                total,
                hasMore: total > skip + messages.length
            };
        } catch (error) {
            logger.error('❌ Error obteniendo historial de mensajes:', error);
            throw error;
        }
    }
}

module.exports = new UserService(); 
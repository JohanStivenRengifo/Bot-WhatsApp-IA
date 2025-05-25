// controllers/webhookController.js
const config = require('../config');
const conversationService = require('../services/conversationService');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');
const metaApiService = require('../services/metaApiService');
const messageHandler = require('../services/messageHandler');

class WebhookController {
    /**
     * Verifica el webhook para la integración con Meta API
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    verifyWebhook(req, res) {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            // Verificar que el token coincida con el configurado
            if (mode === 'subscribe' && token === config.meta.verifyToken) {
                logger.info('✅ Webhook verificado exitosamente');
                return res.status(200).send(challenge);
            } else {
                logger.error('❌ Error de verificación de webhook: token inválido');
                return res.sendStatus(403);
            }
        } catch (error) {
            logger.error('❌ Error en verificación de webhook:', error);
            return res.sendStatus(500);
        }
    }

    /**
     * Procesa los mensajes entrantes desde la API de Meta
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async receiveMessage(req, res) {
        res.status(200).send('EVENT_RECEIVED');
        try {
            const entry = req.body.entry?.[0];
            const change = entry?.changes?.[0];
            const message = change?.value?.messages?.[0];
            const from = message?.from;
            const profileName = change?.value?.contacts?.[0]?.profile?.name || 'Usuario';

            if (!from || !message) return;

            // Normaliza el mensaje recibido
            let normalizedMessage;
            if (message.type === 'text') {
                normalizedMessage = { type: 'text', body: message.text.body };
            } else if (message.type === 'interactive') {
                // Normaliza según el tipo de interacción
                // ...
            } else {
                normalizedMessage = { type: message.type, body: '' };
            }

            await conversationService.processMessage(from, normalizedMessage, profileName);
        } catch (error) {
            logger.error('Error en webhook:', { error: error.message });
        }
    }

    /**
     * Maneja mensajes de texto
     * @param {string} phoneNumber - Número de teléfono del remitente
     * @param {string} userName - Nombre del remitente
     * @param {Object} message - Objeto de mensaje
     */
    async handleTextMessage(phoneNumber, userName, message) {
        try {
            console.log(`📩 Mensaje de texto recibido de ${userName} (${phoneNumber}): ${message.text.body}`);
            await conversationService.processIncomingMessage(phoneNumber, message.text.body, 'text');
        } catch (error) {
            console.error(`❌ Error procesando mensaje de texto de ${phoneNumber}:`, error);
        }
    }

    /**
     * Maneja mensajes interactivos (botones, listas)
     * @param {string} phoneNumber - Número de teléfono del remitente
     * @param {string} userName - Nombre del remitente
     * @param {Object} message - Objeto de mensaje
     */
    async handleInteractiveMessage(phoneNumber, userName, message) {
        try {
            let interactiveData = {
                type: 'interactive',
                id: '',
                title: '',
            };

            // Extraer datos según el tipo de interacción
            if (message.interactive.type === 'button_reply') {
                interactiveData.id = message.interactive.button_reply.id;
                interactiveData.title = message.interactive.button_reply.title;
                // Mantener la estructura original para compatibilidad con los flujos
                interactiveData.interactive = {
                    button_reply: {
                        id: message.interactive.button_reply.id,
                        title: message.interactive.button_reply.title
                    }
                };
            } else if (message.interactive.type === 'list_reply') {
                interactiveData.id = message.interactive.list_reply.id;
                interactiveData.title = message.interactive.list_reply.title;
                // Mantener la estructura original para compatibilidad con los flujos
                interactiveData.interactive = {
                    list_reply: {
                        id: message.interactive.list_reply.id,
                        title: message.interactive.list_reply.title
                    }
                };
            }

            console.log(`📩 Interacción recibida de ${userName} (${phoneNumber}): ${interactiveData.title} [${interactiveData.id}]`);
            await conversationService.processIncomingMessage(phoneNumber, interactiveData, 'interactive');
        } catch (error) {
            console.error(`❌ Error procesando mensaje interactivo de ${phoneNumber}:`, error);
        }
    }

    /**
     * Maneja tipos de mensajes no soportados
     * @param {string} phoneNumber - Número de teléfono del remitente
     * @param {string} messageType - Tipo de mensaje
     */
    async handleUnsupportedMessage(phoneNumber, messageType) {
        try {
            console.log(`📩 Mensaje de tipo ${messageType} recibido de ${phoneNumber} (no soportado)`);
            await whatsappService.sendTextMessage(
                phoneNumber,
                `Lo siento, actualmente no puedo procesar mensajes de tipo ${messageType}. Por favor, envía un mensaje de texto o usa los botones proporcionados.`
            );
        } catch (error) {
            console.error(`❌ Error enviando respuesta a mensaje no soportado a ${phoneNumber}:`, error);
        }
    }

    /**
     * Envía un mensaje manual a un número específico
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async sendManualMessage(req, res) {
        try {
            const { phoneNumber, message } = req.body;

            if (!phoneNumber || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requieren los campos phoneNumber y message',
                });
            }

            // Validar formato del número de teléfono
            if (!/^\d{10,15}$/.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    error: 'Formato de número de teléfono inválido',
                });
            }

            const result = await whatsappService.sendTextMessage(phoneNumber, message);
            return res.status(200).json({
                success: true,
                message: 'Mensaje enviado exitosamente',
                data: result,
            });
        } catch (error) {
            console.error('❌ Error enviando mensaje manual:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error enviando mensaje',
            });
        }
    }

    /**
     * Maneja los eventos recibidos del webhook de WhatsApp
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async handleWebhookEvent(req, res) {
        try {
            const { object, entry } = req.body;

            // Verificar que es un evento de WhatsApp
            if (object !== 'whatsapp_business_account') {
                logger.warn('⚠️ Evento recibido no es de WhatsApp Business', { object });
                return res.status(400).json({ error: 'Evento no válido' });
            }

            // Procesar cada entrada del webhook
            for (const entryItem of entry) {
                const { changes } = entryItem;

                for (const change of changes) {
                    const { value, field } = change;

                    // Procesar diferentes tipos de eventos
                    switch (field) {
                        case 'messages':
                            await this.handleMessages(value);
                            break;
                        case 'message_deliveries':
                            await this.handleMessageDeliveries(value);
                            break;
                        case 'message_reads':
                            await this.handleMessageReads(value);
                            break;
                        case 'message_template_status_updates':
                            await this.handleTemplateStatusUpdates(value);
                            break;
                        default:
                            logger.warn('⚠️ Tipo de evento no manejado', { field });
                    }
                }
            }

            res.status(200).json({ status: 'ok' });
        } catch (error) {
            logger.error('❌ Error procesando evento del webhook:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    /**
     * Maneja los eventos de mensajes
     * @param {Object} value - Datos del evento
     */
    async handleMessages(value) {
        try {
            const { messages, contacts, metadata } = value;

            for (const message of messages) {
                const contact = contacts.find(c => c.wa_id === message.from);

                logger.info('📥 Mensaje recibido', {
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp
                });

                // Procesar el mensaje según su tipo
                switch (message.type) {
                    case 'text':
                        await messageHandler.handleTextMessage(message, contact, metadata);
                        break;
                    case 'interactive':
                        await messageHandler.handleInteractiveMessage(message, contact, metadata);
                        break;
                    case 'image':
                    case 'video':
                    case 'audio':
                    case 'document':
                        await messageHandler.handleMediaMessage(message, contact, metadata);
                        break;
                    case 'location':
                        await messageHandler.handleLocationMessage(message, contact, metadata);
                        break;
                    case 'contacts':
                        await messageHandler.handleContactsMessage(message, contact, metadata);
                        break;
                    default:
                        logger.warn('⚠️ Tipo de mensaje no manejado', { type: message.type });
                }
            }
        } catch (error) {
            logger.error('❌ Error procesando mensajes:', error);
            throw error;
        }
    }

    /**
     * Maneja los eventos de entrega de mensajes
     * @param {Object} value - Datos del evento
     */
    async handleMessageDeliveries(value) {
        try {
            const { statuses } = value;

            for (const status of statuses) {
                logger.info('📨 Estado de entrega de mensaje', {
                    messageId: status.id,
                    status: status.status,
                    timestamp: status.timestamp
                });

                // Actualizar el estado del mensaje en la base de datos
                await messageHandler.updateMessageStatus(status);
            }
        } catch (error) {
            logger.error('❌ Error procesando entregas de mensajes:', error);
            throw error;
        }
    }

    /**
     * Maneja los eventos de lectura de mensajes
     * @param {Object} value - Datos del evento
     */
    async handleMessageReads(value) {
        try {
            const { statuses } = value;

            for (const status of statuses) {
                logger.info('👁️ Mensaje leído', {
                    messageId: status.id,
                    timestamp: status.timestamp
                });

                // Actualizar el estado de lectura del mensaje en la base de datos
                await messageHandler.updateMessageReadStatus(status);
            }
        } catch (error) {
            logger.error('❌ Error procesando lecturas de mensajes:', error);
            throw error;
        }
    }

    /**
     * Maneja las actualizaciones de estado de las plantillas
     * @param {Object} value - Datos del evento
     */
    async handleTemplateStatusUpdates(value) {
        try {
            const { message_template_id, event } = value;

            logger.info('📝 Actualización de estado de plantilla', {
                templateId: message_template_id,
                event
            });

            // Actualizar el estado de la plantilla en la base de datos
            await messageHandler.updateTemplateStatus(message_template_id, event);
        } catch (error) {
            logger.error('❌ Error procesando actualizaciones de plantillas:', error);
            throw error;
        }
    }
}

module.exports = new WebhookController();
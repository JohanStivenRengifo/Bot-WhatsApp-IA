x|// services/conversationService.js
const Conversation = require('../models/conversation');
const MainFlow = require('../flows/mainFlow');
const SupportFlow = require('../flows/supportFlow');
const RegistrationFlow = require('../flows/registrationFlow');
const PrivacyFlow = require('../flows/privacyFlow');
const AuthFlow = require('../flows/authFlow');
const FacturasFlow = require('../flows/facturasFlow');
const PagosFlow = require('../flows/pagosFlow');
const logger = require('../utils/logger');

class ConversationService {
    constructor() {
        this.whatsappService = require('./whatsappService');
        this.flows = {
            privacy: new PrivacyFlow(this.whatsappService),
            auth: new AuthFlow(this.whatsappService),
            main: new MainFlow(this.whatsappService),
            soporte: new SupportFlow(this.whatsappService),
            registro: new RegistrationFlow(this.whatsappService),
            facturas: new FacturasFlow(this.whatsappService),
            pagos: new PagosFlow(this.whatsappService)
        };
    }

    async processMessage(phoneNumber, message, profileName) {
        let conversation;

        try {
            conversation = await this.getOrCreateConversation(phoneNumber, profileName);

            // Si la conversación está en modo de atención humana, no procesar
            if (conversation.isHandedOverToHuman) {
                logger.info('Mensaje recibido en conversación con atención humana:', {
                    phoneNumber,
                    message: typeof message === 'string' ? message.substring(0, 50) : 'interactive message'
                });
                return null;
            }

            // Registrar el mensaje recibido
            // Asegurarse de que el contenido del mensaje sea válido para el esquema
            let messageContent;
            if (typeof message === 'string') {
                messageContent = message; // Mensaje de texto normal
            } else if (message && typeof message === 'object') {
                // Mensaje interactivo u otro tipo de objeto
                // Asegurarse de que el objeto tenga una representación serializable
                messageContent = {
                    type: message.type || 'interactive',
                    id: message.id || '',
                    title: message.title || '',
                    content: '' // Asegurar que el campo content siempre esté presente
                };

                // Si es un mensaje interactivo directo de la API, extraer los datos relevantes
                if (message.interactive && message.interactive.button_reply) {
                    messageContent.id = message.interactive.button_reply.id;
                    messageContent.title = message.interactive.button_reply.title;
                    messageContent.content = message.interactive.button_reply.title; // Usar el título como contenido
                } else if (message.interactive && message.interactive.list_reply) {
                    messageContent.id = message.interactive.list_reply.id;
                    messageContent.title = message.interactive.list_reply.title;
                    messageContent.content = message.interactive.list_reply.title; // Usar el título como contenido
                }
            } else {
                // Valor por defecto si el mensaje es undefined o null
                messageContent = { type: 'unknown', content: 'Mensaje sin contenido' };
            }

            conversation.messages.push({
                from: 'user',
                content: messageContent,
                timestamp: new Date()
            });

            // Procesar el mensaje según el flujo actual
            let response;

            // Si la conversación fue terminada por rechazo de privacidad
            if (conversation.currentFlow === 'ended') {
                logger.info('Intento de mensaje en conversación terminada:', {
                    phoneNumber,
                    reason: conversation.currentStep
                });
                return null;
            }

            // Si no ha aceptado la privacidad, usar el flujo de privacidad
            if (!conversation.hasAcceptedPrivacy) {
                response = await this.flows.privacy.handleFlow(conversation, message);
            } else if (!conversation.userData?.authenticated && conversation.currentFlow !== 'auth') {
                // Si no está autenticado y no está en el flujo de autenticación, redirigir a autenticación
                conversation.currentFlow = 'auth';
                conversation.currentStep = 'inicio';
                response = await this.flows.auth.handleFlow(conversation, message);
            } else {
                response = await this.processFlow(conversation, message);
            }

            // Actualizar última actividad
            conversation.lastActivity = new Date();
            await conversation.save();

            return response;
        } catch (error) {
            logger.error('Error procesando mensaje:', {
                error: error.message,
                stack: error.stack,
                phoneNumber
            });

            // Intentar enviar mensaje de error al usuario
            try {
                await this.whatsappService.sendTextMessage(
                    phoneNumber,
                    "Lo siento, ha ocurrido un error. Por favor, intenta nuevamente en unos momentos."
                );
            } catch (sendError) {
                logger.error('Error enviando mensaje de error:', sendError);
            }

            throw error;
        }
    }

    async getOrCreateConversation(phoneNumber, profileName) {
        let conversation = await Conversation.findOne({ phoneNumber });

        if (!conversation) {
            conversation = new Conversation({
                phoneNumber,
                currentFlow: 'privacy',
                currentStep: 'notice',
                userData: { profileName },
                hasAcceptedPrivacy: false,
                messages: []
            });
        }

        // Actualizar última actividad
        conversation.lastActivity = new Date();
        return conversation;
    }

    async processFlow(conversation, message) {
        // Verificar si el mensaje solicita atención humana en cualquier flujo
        if (typeof message === 'string' && this.requiresHumanAttention(message)) {
            conversation.currentFlow = 'soporte';
            return await this.flows.soporte.handleHumanHandover(conversation);
        }

        // Procesar el mensaje según el flujo actual
        const flow = conversation.currentFlow || 'main';

        if (this.flows[flow]) {
            return await this.flows[flow].handleFlow(conversation, message);
        } else {
            logger.warn('Flujo no encontrado:', {
                flow,
                phoneNumber: conversation.phoneNumber
            });
            conversation.currentFlow = 'main';
            conversation.currentStep = 'welcome';
            return await this.flows.main.handleFlow(conversation, message);
        }
    }

    requiresHumanAttention(message) {
        const keywords = [
            'asesor',
            'humano',
            'persona',
            'agente',
            'hablar con alguien',
            'atención humana',
            'hablar con un agente',
            'necesito ayuda humana',
            'persona real'
        ];

        return keywords.some(keyword =>
            message.toLowerCase().includes(keyword.toLowerCase())
        );
    }
}

module.exports = new ConversationService();
// services/conversationService.js
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

            // Registrar el mensaje recibido
            conversation.messages.push({
                from: 'user',
                content: message,
                timestamp: new Date()
            });

            // Si la conversación fue terminada, no procesar más mensajes
            if (conversation.currentFlow === 'ended') {
                logger.info('Intento de mensaje en conversación terminada:', {
                    phoneNumber,
                    reason: conversation.currentStep
                });
                return null;
            }

            let response;

            // Siempre empezar con el flujo de privacidad para nuevas conversaciones
            if (!conversation.currentFlow || conversation.currentFlow === 'new') {
                conversation.currentFlow = 'privacy';
                conversation.currentStep = 'notice';
                response = await this.flows.privacy.handleFlow(conversation, message);
            }
            // Si no ha aceptado la privacidad, mantener en ese flujo
            else if (!conversation.hasAcceptedPrivacy) {
                response = await this.flows.privacy.handleFlow(conversation, message);
            }
            // Si aceptó la privacidad y es el primer mensaje después de aceptar
            else if (conversation.hasAcceptedPrivacy && conversation.showWelcome) {
                // Enviar mensaje personalizado de bienvenida
                await this.whatsappService.sendTextMessage(
                    phoneNumber,
                    `🤓 ¡Hola! *${profileName || 'Usuario'}*, soy tu asistente virtual y me encanta estar aquí para ayudarte.\n¡Cuenta conmigo!`
                );
                conversation.showWelcome = false;
                conversation.currentFlow = 'auth';
                conversation.currentStep = 'inicio';
                response = await this.flows.auth.handleFlow(conversation, message);
            }
            // Para el resto de los mensajes, procesar según el flujo actual
            else {
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
                userName: profileName,
                currentFlow: 'new',
                currentStep: 'inicio',
                showWelcome: true,
                hasAcceptedPrivacy: false
            });
        }

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
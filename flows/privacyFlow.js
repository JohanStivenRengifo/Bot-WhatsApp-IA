// flows/privacyFlow.js
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

class PrivacyFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    async handleFlow(conversation, message) {
        try {
            switch (conversation.currentStep) {
                case 'notice':
                    return await this.showPrivacyNotice(conversation);
                case 'waiting_response':
                    return await this.handlePrivacyResponse(conversation, message);
                default:
                    return await this.showPrivacyNotice(conversation);
            }
        } catch (error) {
            logger.error('Error en PrivacyFlow:', {
                error: error.message,
                stack: error.stack,
                phoneNumber: conversation.phoneNumber,
                step: conversation.currentStep
            });
            await this.handleFlowError(conversation, error);
            throw error;
        }
    }

    async showPrivacyNotice(conversation) {
        const interactive = {
            type: 'button',
            body: { text: '¿Aceptas nuestra política de privacidad?' },
            action: {
                buttons: [
                    { type: 'reply', reply: { id: 'accept', title: 'Sí, acepto' } },
                    { type: 'reply', reply: { id: 'reject', title: 'No acepto' } }
                ]
            }
        };
        await this.whatsappService.sendInteractiveMessage(conversation.phoneNumber, interactive);
    }

    async handlePrivacyResponse(conversation, message) {
        try {
            // Validar que el mensaje sea del tipo correcto
            if (!message || !message.type) {
                logger.warn('Mensaje inválido recibido:', { message });
                return await this.showPrivacyNotice(conversation);
            }

            // Manejar tanto mensajes directos de la API como mensajes procesados por el controlador
            let buttonId = null;

            if (message.type === 'interactive') {
                // Formato directo de la API de WhatsApp
                if (message.interactive?.button_reply) {
                    buttonId = message.interactive.button_reply.id;
                    // Asegurar que el mensaje tenga un campo content
                    if (!message.content) {
                        message.content = message.interactive.button_reply.title || '';
                    }
                }
                // Formato procesado por el controlador
                else if (message.id) {
                    buttonId = message.id;
                    // Asegurar que el mensaje tenga un campo content
                    if (!message.content) {
                        message.content = message.title || '';
                    }
                }
            }

            if (buttonId === 'accept') {
                // Actualizar el estado de la conversación
                conversation.hasAcceptedPrivacy = true;
                conversation.acceptedPrivacyAt = new Date().toISOString();

                // Enviar mensaje de confirmación
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    '✅ Gracias por aceptar nuestra política de privacidad.'
                );

                // Redirigir al flujo de autenticación en lugar del flujo principal
                conversation.currentFlow = 'auth';
                conversation.currentStep = 'inicio';
                return { flow: 'auth' };

            } else if (buttonId === 'reject') {
                // Enviar mensaje de despedida
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    'Lo sentimos, pero necesitamos tu aceptación de la política de privacidad para continuar. ' +
                    'Si cambias de opinión, puedes escribirnos nuevamente. ¡Que tengas un excelente día! 👋'
                );

                // Finalizar la conversación
                conversation.currentFlow = 'ended';
                conversation.currentStep = 'privacy_rejected';
                conversation.endedAt = new Date().toISOString();
                return null;
            }

            // Si la respuesta no es válida, mostrar el aviso nuevamente
            logger.warn('Respuesta inválida recibida:', {
                messageType: message.type,
                buttonId: buttonId,
                messageId: message.id,
                messageContent: message.content,
                messageTitle: message.title,
                messageInteractive: message.interactive,
                messageStructure: JSON.stringify(message)
            });
            return await this.showPrivacyNotice(conversation);

        } catch (error) {
            logger.error('Error procesando respuesta de privacidad:', {
                error: error.message,
                stack: error.stack,
                phoneNumber: conversation.phoneNumber,
                messageType: message?.type,
                messageId: message?.id,
                messageContent: message?.content,
                messageTitle: message?.title,
                messageInteractive: message?.interactive,
                messageStructure: message ? JSON.stringify(message) : 'null'
            });
            await this.handleFlowError(conversation, error);
            throw error;
        }
    }

    async handleFlowError(conversation, error) {
        try {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                'Lo siento, ha ocurrido un error. Por favor, intenta nuevamente en unos momentos.'
            );

            // Registrar el error en la conversación
            conversation.lastError = {
                message: error.message,
                timestamp: new Date().toISOString()
            };
        } catch (secondaryError) {
            logger.error('Error en el manejador de errores:', {
                originalError: error,
                secondaryError: secondaryError
            });
        }
    }
}

module.exports = PrivacyFlow;

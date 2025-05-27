// flows/privacyFlow.js
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
        try {
            conversation.currentStep = 'waiting_response';

            // En lugar de botones, enviamos instrucciones claras
            const mensaje = 'Conecta2 Telecomunicaciones trata tus datos personales conforme a la Ley 1581 de 2012.\n\n' +
                'Tus datos serán utilizados para:\n' +
                '• Gestionar tu solicitud\n' +
                '• Brindarte soporte técnico\n' +
                '• Enviarte información relevante\n\n' +
                'Para continuar, por favor responde "SI ACEPTO" o "NO ACEPTO".';

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                '🔒 Aviso de Privacidad\n\n' + mensaje
            );
            return null;
        } catch (error) {
            logger.error('Error mostrando aviso de privacidad:', error);
            throw error;
        }
    }

    async handlePrivacyResponse(conversation, message) {
        try {
            // Si es un mensaje de texto que dice "SI ACEPTO"
            if (message.type === 'text' && message.text.toUpperCase().trim() === 'SI ACEPTO') {
                conversation.hasAcceptedPrivacy = true;
                conversation.acceptedPrivacyAt = new Date().toISOString();
                conversation.currentFlow = 'auth';
                conversation.currentStep = 'inicio';
                await conversation.save();

                // Enviar mensaje de bienvenida personalizado una sola vez
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    `🤓 ¡Hola! *${conversation.userName || 'Usuario'}*, soy tu asistente virtual y me encanta estar aquí para ayudarte.\n¡Cuenta conmigo!`
                );

                return { flow: 'auth', step: 'inicio' };

            } else if (message.type === 'text' && message.text.toUpperCase().trim() === 'NO ACEPTO') {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    'Lo sentimos, pero necesitamos tu aceptación de la política de privacidad para continuar. ' +
                    'Si cambias de opinión, puedes escribirnos nuevamente. ¡Que tengas un excelente día! 👋'
                );

                conversation.currentFlow = 'ended';
                conversation.currentStep = 'privacy_rejected';
                conversation.endedAt = new Date().toISOString();
                await conversation.save();
                return null;
            }

            // Si el mensaje no coincide con ninguna opción válida
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                'Por favor, responde exactamente "SI ACEPTO" o "NO ACEPTO" para continuar.'
            );
            return null;

        } catch (error) {
            logger.error('Error procesando respuesta de privacidad:', {
                error: error.message,
                phoneNumber: conversation.phoneNumber,
                message: message
            });
            throw error;
        }
    }

    async handleFlowError(conversation, error) {
        try {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                'Lo siento, ha ocurrido un error. Por favor, intenta nuevamente en unos momentos.'
            );
        } catch (secondaryError) {
            logger.error('Error en el manejador de errores:', {
                originalError: error,
                secondaryError
            });
        }
    }
}

module.exports = PrivacyFlow;

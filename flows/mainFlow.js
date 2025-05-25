// flows/mainFlow.js
const { MessageTemplates } = require('../utils/botUtils');

class MainFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    async handleFlow(conversation, message) {
        const step = conversation.currentStep || 'welcome';

        switch (step) {
            case 'welcome':
                return this.handleWelcome(conversation);
            case 'menu':
                return this.handleMenu(conversation, message);
            default:
                return this.handleWelcome(conversation);
        }
    }

    async handleWelcome(conversation) {
        conversation.currentStep = 'menu';

        const buttons = [
            {
                type: 'reply',
                reply: {
                    id: 'registro',
                    title: '📝 Registro'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'soporte',
                    title: '🛠️ Soporte'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'info',
                    title: 'ℹ️ Información'
                }
            }
        ];

        await this.whatsappService.sendInteractiveMessage(
            conversation.phoneNumber,
            '¡Bienvenido a Conecta2! 👋',
            '¿En qué puedo ayudarte hoy?',
            buttons
        );
        return null;
    }

    async handleMenu(conversation, message) {
        const action = message.toLowerCase();

        if (action.includes('registro')) {
            conversation.currentFlow = 'registro';
            conversation.currentStep = 'inicio';
            return { flow: 'registro' };
        } else if (action.includes('soporte')) {
            conversation.currentFlow = 'soporte';
            conversation.currentStep = 'inicio';
            return { flow: 'soporte' };
        } else if (action.includes('info')) {
            conversation.currentFlow = 'info';
            conversation.currentStep = 'inicio';
            return { flow: 'info' };
        } else {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "⚠️ Por favor, selecciona una de las opciones disponibles."
            );
            return await this.handleWelcome(conversation);
        }
    }
}

module.exports = MainFlow;

// flows/supportFlow.js
const { BotUtils } = require('../utils/botUtils');

class SupportFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.handoverService = require('../services/handoverService');
        this.wisphubService = require('../services/wisphubService');
    }

    async handleFlow(conversation, message) {
        // Verificar palabras clave para atención humana
        if (this.requiresHumanAttention(message)) {
            return this.handleHumanHandover(conversation);
        }

        const step = conversation.currentStep || 'inicio';

        switch (step) {
            case 'inicio':
                return this.handleInicio(conversation);
            case 'tipo_problema':
                return this.handleTipoProblema(conversation, message);
            case 'descripcion':
                return this.handleDescripcion(conversation, message);
            case 'confirmar':
                return this.handleConfirmar(conversation, message);
            default:
                return this.handleInicio(conversation);
        }
    }

    requiresHumanAttention(message) {
        if (!message || typeof message !== 'string') return false;

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

    async handleHumanHandover(conversation) {
        try {
            // Crear un ticket en Wisphub antes del handover
            if (conversation.userData?.authenticated) {
                await this.wisphubService.crearTicketSoporte(conversation.userData.id, {
                    subject: 'Solicitud de atención humana',
                    description: 'Cliente solicitó atención de un agente humano vía WhatsApp',
                    priority: 'high',
                    category: 'support'
                });
            }

            // Notificar al usuario
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Te estamos conectando con un agente humano. Por favor, espera un momento... 👨‍💼"
            );

            // Realizar el handover
            await this.handoverService.passThreadControl(
                conversation.phoneNumber,
                "Usuario solicitó atención humana"
            );

            // Actualizar el estado de la conversación
            conversation.isHandedOverToHuman = true;
            conversation.handoverTimestamp = new Date();
            conversation.currentFlow = 'human';
            conversation.currentStep = 'waiting';

            return null;
        } catch (error) {
            logger.error('Error en handover:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Lo siento, hubo un problema al conectarte con un agente. Por favor, intenta nuevamente en unos momentos."
            );
            return null;
        }
    }

    async handleInicio(conversation) {
        const buttons = [
            {
                type: 'reply',
                reply: {
                    id: 'technical',
                    title: '🔧 Soporte Técnico'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'billing',
                    title: '💰 Facturación'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'human_agent',
                    title: '👨‍💼 Hablar con Agente'
                }
            }
        ];

        await this.whatsappService.sendInteractiveMessage(
            conversation.phoneNumber,
            'Centro de Soporte',
            '¿En qué podemos ayudarte hoy?',
            buttons
        );

        conversation.currentStep = 'tipo_problema';
        return null;
    }

    async handleTipoProblema(conversation, message) {
        if (!message.type === 'interactive' || !message.interactive?.button_reply?.id) {
            return this.handleInicio(conversation);
        }

        const option = message.interactive.button_reply.id;

        if (option === 'human_agent') {
            return this.handleHumanHandover(conversation);
        }

        conversation.userData.tipoProblema = option;
        conversation.currentStep = 'descripcion';

        await this.whatsappService.sendTextMessage(
            conversation.phoneNumber,
            "Por favor, describe brevemente el problema que estás experimentando. Sé lo más específico posible."
        );
        return null;
    }

    async handleDescripcion(conversation, message) {
        if (this.requiresHumanAttention(message)) {
            return this.handleHumanHandover(conversation);
        }

        conversation.userData.descripcion = message;

        // Si el usuario está autenticado, crear el ticket directamente
        if (conversation.userData?.authenticated) {
            try {
                const ticket = await this.wisphubService.crearTicketSoporte(
                    conversation.userData.id,
                    {
                        subject: `Soporte: ${conversation.userData.tipoProblema}`,
                        description: conversation.userData.descripcion,
                        priority: 'medium',
                        category: conversation.userData.tipoProblema
                    }
                );

                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    `✅ Ticket #${ticket.id} creado exitosamente.\n\n` +
                    "Un técnico revisará tu caso y se pondrá en contacto contigo pronto.\n\n" +
                    "¿Necesitas algo más?"
                );

                conversation.currentFlow = 'main';
                conversation.currentStep = 'menu';
                return { flow: 'main' };
            } catch (error) {
                logger.error('Error creando ticket:', error);
                return this.handleHumanHandover(conversation);
            }
        }

        // Si no está autenticado, transferir a un agente humano
        return this.handleHumanHandover(conversation);
    }

    async handleConfirmar(conversation, message) {
        if (message.type === 'interactive' && message.interactive?.button_reply?.id === 'confirmar_si') {
            const buttons = [
                {
                    type: 'reply',
                    reply: {
                        id: 'menu_si',
                        title: '✅ Sí, volver al menú'
                    }
                },
                {
                    type: 'reply',
                    reply: {
                        id: 'menu_no',
                        title: '❌ No, gracias'
                    }
                }
            ];

            await this.whatsappService.sendInteractiveMessage(
                conversation.phoneNumber,
                'Ticket Creado',
                `✅ Ticket #${conversation.userData.ticketId} creado exitosamente.\n\nUn técnico revisará tu caso y se pondrá en contacto contigo pronto.\n\n¿Necesitas algo más?`,
                buttons
            );

            conversation.currentFlow = 'main';
            conversation.currentStep = 'menu';
            return { flow: 'main' };
        } else {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Entiendo, empecemos de nuevo con tu solicitud de soporte."
            );
            return this.handleInicio(conversation);
        }
    }
}

module.exports = SupportFlow;

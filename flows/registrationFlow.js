// flows/registrationFlow.js
class RegistrationFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    async handleFlow(conversation, message) {
        const step = conversation.currentStep || 'inicio';

        switch (step) {
            case 'inicio':
                return this.handleInicio(conversation);
            case 'plan':
                return this.handlePlan(conversation, message);
            case 'direccion':
                return this.handleDireccion(conversation, message);
            case 'confirmar':
                return this.handleConfirmar(conversation, message);
            default:
                return this.handleInicio(conversation);
        }
    }

    async handleInicio(conversation) {
        conversation.currentStep = 'plan';

        const buttons = [
            {
                type: 'reply',
                reply: {
                    id: 'internet_100',
                    title: '🚀 Internet 100MB'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'internet_200',
                    title: '⚡ Internet 200MB'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'internet_500',
                    title: '💫 Internet 500MB'
                }
            }
        ];

        await this.whatsappService.sendInteractiveMessage(
            conversation.phoneNumber,
            'Planes Disponibles',
            '¿Qué plan te interesa contratar?',
            buttons
        );
        return null;
    }

    async handlePlan(conversation, message) {
        conversation.userData = conversation.userData || {};
        conversation.userData.plan = message;
        conversation.currentStep = 'direccion';

        await this.whatsappService.sendTextMessage(
            conversation.phoneNumber,
            "Por favor, comparte tu dirección completa para verificar la cobertura en tu zona."
        );
        return null;
    }

    async handleDireccion(conversation, message) {
        conversation.userData.direccion = message;
        conversation.currentStep = 'confirmar';

        const buttons = [
            {
                type: 'reply',
                reply: {
                    id: 'confirmar_si',
                    title: '✅ Sí, continuar'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'confirmar_no',
                    title: '❌ No, corregir'
                }
            }
        ];

        await this.whatsappService.sendInteractiveMessage(
            conversation.phoneNumber,
            'Confirmar Registro',
            `📝 Resumen de tu solicitud:\n\nPlan: ${conversation.userData.plan}\nDirección: ${conversation.userData.direccion}\n\n¿Los datos son correctos?`,
            buttons
        );
        return null;
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
                'Registro Exitoso',
                '✅ ¡Solicitud registrada con éxito!\n\nUn asesor se pondrá en contacto contigo pronto para coordinar la instalación.\n\n¿Necesitas algo más?',
                buttons
            );

            conversation.currentFlow = 'main';
            conversation.currentStep = 'menu';
            return { flow: 'main' };
        } else {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Entiendo, empecemos de nuevo con tu registro."
            );
            return this.handleInicio(conversation);
        }
    }
}

module.exports = RegistrationFlow;

// flows/mainFlow.js
const { MessageTemplates } = require('../utils/botUtils');

class MainFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    async handleFlow(conversation, message) {
        if (!conversation.currentStep) {
            return await this.showMainMenu(conversation);
        }

        if (conversation.currentStep === 'menu') {
            return await this.handleMenu(conversation, message);
        }

        return null;
    }

    async showMainMenu(conversation) {
        conversation.currentStep = 'menu';
        await conversation.save();

        const menuMessage =
            "🌟 *Menu Principal*\n\n" +
            "Selecciona una opcion escribiendo el numero correspondiente:\n\n" +
            "1️⃣ *Facturas*\n" +
            "   • Ver facturas pendientes\n" +
            "   • Consultar saldo\n" +
            "   • Puntos de pago\n\n" +
            "2️⃣ *Pagos*\n" +
            "   • Enviar comprobante\n" +
            "   • Ver historial de pagos\n\n" +
            "3️⃣ *Soporte Tecnico*\n" +
            "   • Reportar fallas\n" +
            "   • Estado del servicio\n\n" +
            "4️⃣ *Mi Cuenta*\n" +
            "   • Mi plan\n" +
            "   • Cambio de contrasena\n\n" +
            "5️⃣ *Asesor* 👨‍💼\n" +
            "   • Hablar con un asesor\n\n" +
            "❓ Escribe el numero de la opcion que necesitas";

        await this.whatsappService.sendTextMessage(
            conversation.phoneNumber,
            menuMessage
        );
        return null;
    }

    async handleMenu(conversation, message) {
        const text = message.text ? message.text.trim() : '';

        switch (text) {
            case '1':
                conversation.currentFlow = 'facturas';
                conversation.currentStep = 'inicio';
                return { flow: 'facturas' };

            case '2':
                conversation.currentFlow = 'pagos';
                conversation.currentStep = 'inicio';
                return { flow: 'pagos' };

            case '3':
                conversation.currentFlow = 'support';
                conversation.currentStep = 'inicio';
                return { flow: 'support' };

            case '4':
                conversation.currentFlow = 'account';
                conversation.currentStep = 'inicio';
                return { flow: 'account' };

            case '5':
                conversation.currentFlow = 'agent';
                conversation.currentStep = 'inicio';
                return { flow: 'agent' };

            default:
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    '❌ Opcion no valida. Por favor, escribe un numero del 1 al 5.'
                );
                return await this.showMainMenu(conversation);
        }
    }
}

module.exports = MainFlow;
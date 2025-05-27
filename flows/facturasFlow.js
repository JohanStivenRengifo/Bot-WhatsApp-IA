// flows/facturasFlow.js
const WisphubService = require('../services/wisphubService');
const { formatCurrency } = require('../utils/botUtils');
const logger = require('../utils/logger');

class FacturasFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.wisphubService = new WisphubService();
    }

    async handleFlow(conversation, message) {
        const step = conversation.currentStep || 'inicio';

        switch (step) {
            case 'inicio':
                return this.handleInicio(conversation);
            case 'ver_detalles':
                return this.handleVerDetalles(conversation, message);
            case 'filtrar':
                return this.handleFiltrar(conversation, message);
            default:
                return this.handleInicio(conversation);
        }
    }

    async handleInicio(conversation) {
        try {
            const facturas = await this.wisphubService.getFacturasCliente(conversation.userData.id);

            if (!facturas || facturas.length === 0) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "✨ ¡Genial! No tienes facturas pendientes de pago."
                );
                return { flow: 'main' };
            }

            let mensaje = "📋 Tus facturas:\n\n";
            facturas.forEach((factura, index) => {
                mensaje += `${index + 1}. Factura #${factura.number}\n`;
                mensaje += `   💰 Monto: ${formatCurrency(factura.amount)}\n`;
                mensaje += `   📅 Vence: ${new Date(factura.due_date).toLocaleDateString()}\n`;
                mensaje += `   📊 Estado: ${this.translateStatus(factura.status)}\n\n`;
            });

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                mensaje
            );

            const buttons = [
                {
                    type: 'reply',
                    reply: {
                        id: 'ver_vencidas',
                        title: '⚠️ Ver Vencidas'
                    }
                },
                {
                    type: 'reply',
                    reply: {
                        id: 'registrar_pago',
                        title: '💳 Registrar Pago'
                    }
                },
                {
                    type: 'reply',
                    reply: {
                        id: 'menu_principal',
                        title: '🏠 Menú Principal'
                    }
                }
            ];

            conversation.currentStep = 'ver_detalles';
            await this.whatsappService.sendInteractiveMessage(
                conversation.phoneNumber,
                'Opciones de Facturas',
                '¿Qué deseas hacer?',
                buttons
            );

            return null;
        } catch (error) {
            logger.error('Error en flujo de facturas:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Lo siento, hubo un error al consultar tus facturas. Por favor, intenta más tarde."
            );
            return { flow: 'main' };
        }
    }

    async handleVerDetalles(conversation, message) {
        if (!message.type === 'interactive' || !message.interactive?.button_reply?.id) {
            return null;
        }

        const option = message.interactive.button_reply.id;

        switch (option) {
            case 'ver_vencidas':
                conversation.currentStep = 'filtrar';
                const facturasVencidas = await this.wisphubService.getFacturasCliente(
                    conversation.userData.id,
                    { status: 'overdue' }
                );

                if (!facturasVencidas || facturasVencidas.length === 0) {
                    await this.whatsappService.sendTextMessage(
                        conversation.phoneNumber,
                        "✨ ¡Buenas noticias! No tienes facturas vencidas."
                    );
                } else {
                    let mensaje = "⚠️ Facturas vencidas:\n\n";
                    facturasVencidas.forEach((factura, index) => {
                        mensaje += `${index + 1}. Factura #${factura.number}\n`;
                        mensaje += `   💰 Monto: ${formatCurrency(factura.amount)}\n`;
                        mensaje += `   📅 Venció: ${new Date(factura.due_date).toLocaleDateString()}\n`;
                        mensaje += `   ⚠️ Días vencida: ${this.calcularDiasVencida(factura.due_date)}\n\n`;
                    });
                    await this.whatsappService.sendTextMessage(
                        conversation.phoneNumber,
                        mensaje
                    );
                }
                return this.handleInicio(conversation);

            case 'registrar_pago':
                conversation.currentFlow = 'pagos';
                conversation.currentStep = 'inicio';
                return { flow: 'pagos' };

            case 'menu_principal':
                conversation.currentFlow = 'main';
                conversation.currentStep = 'menu';
                return { flow: 'main' };

            default:
                return this.handleInicio(conversation);
        }
    }

    translateStatus(status) {
        const estados = {
            'paid': '✅ Pagada',
            'unpaid': '⏳ Pendiente',
            'overdue': '⚠️ Vencida',
            'cancelled': '❌ Cancelada'
        };
        return estados[status] || status;
    }

    calcularDiasVencida(dueDate) {
        const hoy = new Date();
        const vencimiento = new Date(dueDate);
        const diferencia = hoy - vencimiento;
        return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    }
}

module.exports = FacturasFlow;

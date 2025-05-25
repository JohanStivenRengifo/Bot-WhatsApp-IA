// flows/pagosFlow.js
const wisphubService = require('../services/wisphubService');
const { formatCurrency } = require('../utils/botUtils');
const logger = require('../utils/logger');

class PagosFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    async handleFlow(conversation, message) {
        const step = conversation.currentStep || 'inicio';

        switch (step) {
            case 'inicio':
                return this.handleInicio(conversation);
            case 'seleccionar_factura':
                return this.handleSeleccionarFactura(conversation, message);
            case 'ingresar_monto':
                return this.handleIngresarMonto(conversation, message);
            case 'confirmar_pago':
                return this.handleConfirmarPago(conversation, message);
            default:
                return this.handleInicio(conversation);
        }
    }

    async handleInicio(conversation) {
        try {
            const facturas = await wisphubService.getFacturasCliente(
                conversation.userData.id,
                { status: 'unpaid' }
            );

            if (!facturas || facturas.length === 0) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "✨ ¡No tienes facturas pendientes de pago!"
                );
                return { flow: 'main' };
            }

            conversation.userData.facturasTemp = facturas;
            let mensaje = "📋 Selecciona la factura a pagar:\n\n";
            facturas.forEach((factura, index) => {
                mensaje += `${index + 1}. Factura #${factura.number}\n`;
                mensaje += `   💰 Monto: ${formatCurrency(factura.amount)}\n`;
                mensaje += `   📅 Vence: ${new Date(factura.due_date).toLocaleDateString()}\n\n`;
            });

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                mensaje + "\nEscribe el número de la factura que deseas pagar:"
            );

            conversation.currentStep = 'seleccionar_factura';
            return null;
        } catch (error) {
            logger.error('Error en inicio de pagos:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Lo siento, hubo un error al consultar tus facturas. Por favor, intenta más tarde."
            );
            return { flow: 'main' };
        }
    }

    async handleSeleccionarFactura(conversation, message) {
        const seleccion = parseInt(message.trim());
        const facturas = conversation.userData.facturasTemp;

        if (isNaN(seleccion) || seleccion < 1 || seleccion > facturas.length) {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "⚠️ Por favor, selecciona un número válido de factura."
            );
            return this.handleInicio(conversation);
        }

        const facturaSeleccionada = facturas[seleccion - 1];
        conversation.userData.pagoTemp = {
            facturaId: facturaSeleccionada.id,
            monto: facturaSeleccionada.amount,
            numero: facturaSeleccionada.number
        };

        await this.whatsappService.sendTextMessage(
            conversation.phoneNumber,
            `Has seleccionado la Factura #${facturaSeleccionada.number}\n` +
            `Monto a pagar: ${formatCurrency(facturaSeleccionada.amount)}\n\n` +
            "Por favor, ingresa el monto que vas a pagar:"
        );

        conversation.currentStep = 'ingresar_monto';
        return null;
    }

    async handleIngresarMonto(conversation, message) {
        const monto = parseFloat(message.trim().replace(/[^0-9.]/g, ''));
        const facturaInfo = conversation.userData.pagoTemp;

        if (isNaN(monto) || monto <= 0 || monto > facturaInfo.monto) {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "⚠️ Por favor, ingresa un monto válido que no supere el valor de la factura."
            );
            return null;
        }

        conversation.userData.pagoTemp.montoAPagar = monto;

        const buttons = [
            {
                type: 'reply',
                reply: {
                    id: 'confirmar_pago',
                    title: '✅ Confirmar Pago'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'cancelar_pago',
                    title: '❌ Cancelar'
                }
            }
        ];

        await this.whatsappService.sendInteractiveMessage(
            conversation.phoneNumber,
            'Confirmar Pago',
            `📝 Resumen del pago:\n\n` +
            `Factura: #${facturaInfo.numero}\n` +
            `Monto a pagar: ${formatCurrency(monto)}\n\n` +
            `¿Deseas confirmar el pago?`,
            buttons
        );

        conversation.currentStep = 'confirmar_pago';
        return null;
    }

    async handleConfirmarPago(conversation, message) {
        if (!message.type === 'interactive' || !message.interactive?.button_reply?.id) {
            return null;
        }

        const option = message.interactive.button_reply.id;

        if (option === 'confirmar_pago') {
            try {
                const pagoInfo = conversation.userData.pagoTemp;
                await wisphubService.registrarPago(conversation.userData.id, {
                    amount: pagoInfo.montoAPagar,
                    invoice_ids: [pagoInfo.facturaId],
                    payment_method: 'other',
                    notes: 'Pago registrado vía WhatsApp'
                });

                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "✅ ¡Pago registrado exitosamente!\n\n" +
                    `Factura: #${pagoInfo.numero}\n` +
                    `Monto pagado: ${formatCurrency(pagoInfo.montoAPagar)}\n\n` +
                    "Gracias por tu pago."
                );

                delete conversation.userData.pagoTemp;
                delete conversation.userData.facturasTemp;

                conversation.currentFlow = 'main';
                conversation.currentStep = 'menu';
                return { flow: 'main' };

            } catch (error) {
                logger.error('Error registrando pago:', error);
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "❌ Lo siento, hubo un error al registrar el pago. Por favor, intenta nuevamente."
                );
                return this.handleInicio(conversation);
            }
        } else {
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Pago cancelado. ¿Deseas realizar otra operación?"
            );
            conversation.currentFlow = 'main';
            conversation.currentStep = 'menu';
            return { flow: 'main' };
        }
    }
}

module.exports = PagosFlow;

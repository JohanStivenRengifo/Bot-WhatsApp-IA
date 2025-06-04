import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, PaymentService, AIService } from '../services';

/**
 * Flujo para verificación de comprobantes de pago con análisis de imágenes
 */
export class PaymentVerificationFlow extends BaseConversationFlow {
    readonly name: string = 'paymentVerification';

    private paymentService: PaymentService;
    private aiService: AIService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        paymentService: PaymentService,
        aiService: AIService
    ) {
        super(messageService, securityService);
        this.paymentService = paymentService;
        this.aiService = aiService;
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        return (
            user.authenticated &&
            (message === 'verificar_pago' ||
                message === 'comprobante_pago' ||
                message === 'enviar_comprobante' ||
                session.verifyingPayment === true)
        );
    }

    /**
     * Maneja el proceso de verificación de pagos
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            if (!session.verifyingPayment) {
                return await this.initializePaymentVerification(user, session);
            }

            // Procesar según el paso actual
            switch (session.step) {
                case 'payment_verification':
                    return await this.processPaymentProof(user, message, session);
                default:
                    return await this.initializePaymentVerification(user, session);
            }

        } catch (error) {
            console.error('Error en flujo de verificación de pago:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error procesando la verificación. Por favor, intenta nuevamente o contacta soporte.');

            this.resetPaymentSession(session);
            return true;
        }
    }

    /**
     * Inicializa el proceso de verificación de pago
     */
    private async initializePaymentVerification(user: User, session: SessionData): Promise<boolean> {
        session.verifyingPayment = true;
        session.step = 'payment_verification';

        // Obtener información de facturas pendientes
        let pendingInvoiceInfo = '';
        try {
            const invoices = await this.paymentService.getPendingInvoices(user.customerId!);
            if (invoices.length > 0) {
                const latestInvoice = invoices[0];
                pendingInvoiceInfo = `\n\n💰 **Factura pendiente detectada:**\n` +
                    `• Valor: $${latestInvoice.amount.toLocaleString()}\n` +
                    `• Vencimiento: ${latestInvoice.dueDate}\n` +
                    `• Referencia: ${latestInvoice.reference}`;
            }
        } catch (error) {
            console.error('Error obteniendo facturas pendientes:', error);
        }

        await this.messageService.sendTextMessage(user.phoneNumber,
            '💳 **Verificación de Comprobante de Pago**\n\n' +
            '📄 Envía la imagen de tu comprobante de pago y lo verificaré automáticamente.\n\n' +
            '✅ **Tipos de comprobante aceptados:**\n' +
            '• Transferencias bancarias\n' +
            '• Pagos en efectivo (recibos)\n' +
            '• Pagos PSE\n' +
            '• Pagos en puntos autorizados\n' +
            '• Capturas de pantalla de apps bancarias\n\n' +
            '📸 **¿Cómo enviar?**\n' +
            '• Toma una foto clara del comprobante\n' +
            '• Asegúrate de que se vean todos los datos\n' +
            '• Envía la imagen por WhatsApp\n\n' +
            '🔍 **Verificaré automáticamente:**\n' +
            '• Monto del pago\n' +
            '• Fecha de transacción\n' +
            '• Número de referencia\n' +
            '• Banco/entidad emisora' +
            pendingInvoiceInfo);

        return true;
    }

    /**
     * Procesa el comprobante de pago enviado
     */
    private async processPaymentProof(user: User, message: string, session: SessionData): Promise<boolean> {
        // En un escenario real, aquí recibiríamos el mensaje con la imagen
        // Para la simulación, procesaremos como si fuera una imagen válida

        if (message === 'imagen_comprobante' || message.includes('comprobante') || message.includes('pago')) {
            await this.analyzePaymentImage(user, session);
            return true;
        }

        await this.messageService.sendTextMessage(user.phoneNumber,
            '📸 Por favor, envía la imagen de tu comprobante de pago.\n\n' +
            '💡 Si tienes problemas enviando la imagen:\n' +
            '• Verifica que la imagen no sea muy pesada\n' +
            '• Intenta tomar una nueva foto\n' +
            '• Escribe "ayuda_imagen" para más instrucciones');

        return true;
    }

    /**
     * Analiza la imagen del comprobante usando IA
     */
    private async analyzePaymentImage(user: User, session: SessionData): Promise<boolean> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🔍 **Analizando comprobante...**\n\n' +
            '🤖 Procesando imagen con IA\n' +
            '📊 Extrayendo datos de pago\n' +
            '⏱️ Esto puede tomar unos segundos...');

        try {
            // Simular análisis con IA (en implementación real, usaría OCR y análisis de imagen)
            const analysisResult = await this.simulateImageAnalysis(user.customerId!);

            if (analysisResult.success) {
                await this.handleSuccessfulVerification(user, analysisResult, session);
            } else {
                await this.handleFailedVerification(user, analysisResult.reason!, session);
            }

            return true;

        } catch (error) {
            console.error('Error analizando imagen:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error procesando la imagen. Por favor:\n\n' +
                '• Verifica que la imagen sea clara\n' +
                '• Intenta enviar una nueva foto\n' +
                '• Contacta soporte si persiste el problema');
            return true;
        }
    }

    /**
     * Maneja verificación exitosa
     */
    private async handleSuccessfulVerification(user: User, result: any, session: SessionData): Promise<boolean> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🎉 **¡Comprobante Verificado Exitosamente!**\n\n' +
            '✅ **Datos extraídos:**\n' +
            `💰 Monto: $${result.amount?.toLocaleString() || '0'}\n` +
            `📅 Fecha: ${result.date || 'No detectada'}\n` +
            `🏦 Banco: ${result.bank || 'No detectado'}\n` +
            `🔢 Referencia: ${result.reference || 'No detectada'}\n\n` +
            '⚡ **Estado del pago:**\n' +
            '• Tu pago ha sido registrado\n' +
            '• Se actualizará tu estado de cuenta\n' +
            '• Recibirás confirmación en 15-30 minutos\n\n' +
            '📱 Te notificaremos cuando el pago esté reflejado en tu cuenta.');

        // Registrar el pago en el sistema
        try {
            await this.paymentService.registerPayment(user.customerId!, {
                amount: result.amount,
                date: result.date,
                reference: result.reference,
                bank: result.bank,
                source: 'whatsapp_verification',
                imageAnalysis: true
            });

            // Enviar segunda confirmación con más detalles
            setTimeout(async () => {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '📋 **Información adicional:**\n\n' +
                    '• Si tu servicio estaba suspendido, se reactivará automáticamente\n' +
                    '• Puedes consultar tu estado de cuenta con "deuda"\n' +
                    '• Si tienes dudas, escribe "estado_pago"\n\n' +
                    '¡Gracias por tu pago! 😊');
            }, 3000);

        } catch (error) {
            console.error('Error registrando pago:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '⚠️ Comprobante verificado pero hubo un error registrando el pago.\n\n' +
                'Un agente revisará manualmente tu comprobante y te contactará pronto.');
        }

        this.resetPaymentSession(session);
        return true;
    }

    /**
     * Maneja verificación fallida
     */
    private async handleFailedVerification(user: User, reason: string, session: SessionData): Promise<boolean> {
        const helpMessage = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '❌ Verificación Fallida'
                },
                body: {
                    text: `No pude verificar tu comprobante automáticamente.\n\n**Razón:** ${reason}\n\n¿Qué deseas hacer?`
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'retry_image',
                                title: '📸 Intentar de nuevo'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'manual_review',
                                title: '👨‍💻 Revisión manual'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'help_payment',
                                title: '❓ Necesito ayuda'
                            }
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(helpMessage);

        // Manejar respuesta del usuario
        // En implementación real, esto se manejaría en el siguiente mensaje

        return true;
    }

    /**
     * Simula el análisis de imagen con IA
     */
    private async simulateImageAnalysis(customerId: string): Promise<{
        success: boolean;
        amount?: number;
        date?: string;
        bank?: string;
        reference?: string;
        reason?: string;
    }> {
        // Simular diferentes escenarios de análisis
        const scenarios = [
            {
                success: true,
                amount: 58900,
                date: new Date().toISOString().split('T')[0],
                bank: 'Bancolombia',
                reference: 'REF' + Math.floor(Math.random() * 1000000)
            },
            {
                success: true,
                amount: 78900,
                date: new Date().toISOString().split('T')[0],
                bank: 'Banco de Bogotá',
                reference: 'BB' + Math.floor(Math.random() * 1000000)
            },
            {
                success: false,
                reason: 'Imagen borrosa o poco clara. Por favor, toma una foto más nítida.'
            },
            {
                success: false,
                reason: 'No se pudo detectar el monto del pago. Verifica que esté visible en la imagen.'
            }
        ];

        // Retornar escenario aleatorio (85% de éxito)
        const successRate = Math.random();
        if (successRate < 0.85) {
            return scenarios[Math.floor(Math.random() * 2)]; // Escenarios exitosos
        } else {
            return scenarios[2 + Math.floor(Math.random() * 2)]; // Escenarios fallidos
        }
    }

    /**
     * Resetea el estado de sesión de verificación de pago
     */
    private resetPaymentSession(session: SessionData): void {
        session.verifyingPayment = false;
        session.step = undefined;
    }
}

import { ConversationFlow } from './ConversationFlow';
import { User, SessionData, WhatsAppMessage } from '../interfaces';
import { MessageService } from '../services/MessageService';
import { ImageStorageService, ImageMetadata } from '../services/ImageStorageService';
import { PaymentValidationService, PaymentValidationResult } from '../services/PaymentValidationService';
import { TicketService } from '../services/TicketService';

export class PaymentReceiptFlow implements ConversationFlow {
    name = 'PaymentReceiptFlow';
    private messageService: MessageService;
    private imageStorageService: ImageStorageService;
    private paymentValidationService: PaymentValidationService;
    private ticketService: TicketService;

    constructor() {
        this.messageService = new MessageService();
        this.imageStorageService = new ImageStorageService();
        this.paymentValidationService = new PaymentValidationService();
        this.ticketService = new TicketService();
    }

    async canHandle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        // Si es un mensaje de texto sobre comprobantes
        if (typeof message === 'string') {
            const lowerMessage = message.toLowerCase();
            return lowerMessage.includes('comprobante') ||
                lowerMessage.includes('pago') ||
                lowerMessage.includes('transferencia') ||
                lowerMessage.includes('factura');
        }

        // Si es un mensaje con imagen
        if (typeof message === 'object' && message.type === 'image') {
            return true;
        }

        return false;
    }

    async handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        try {
            // Manejar imagen de comprobante
            if (typeof message === 'object' && message.type === 'image') {
                return await this.handlePaymentReceiptImage(user, message);
            }

            // Manejar mensajes de texto sobre comprobantes
            if (typeof message === 'string') {
                return await this.handlePaymentInquiry(user, message);
            }

            return false;
        } catch (error) {
            console.error('Error en PaymentReceiptFlow:', error); await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Ocurrió un error procesando tu solicitud. Por favor intenta nuevamente.'
            );
            return true;
        }
    }

    /**
     * Maneja imágenes de comprobantes de pago
     */
    private async handlePaymentReceiptImage(user: User, message: WhatsAppMessage): Promise<boolean> {
        try {            // Enviar mensaje de procesamiento
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '📄 Recibido comprobante de pago. Analizando imagen...\n\nEsto puede tomar unos segundos.'
            );            // Guardar imagen
            console.log(`📥 Guardando imagen de comprobante de ${user.phoneNumber}`);
            const imageMetadata: ImageMetadata | null = await this.imageStorageService.downloadAndSaveImage(
                message.image!.id,
                user.phoneNumber,
                'payment_receipt'
            );

            if (!imageMetadata) {
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '❌ No pude descargar la imagen. Por favor intenta nuevamente.'
                );
                return true;
            }

            console.log(`✅ Imagen guardada: ${imageMetadata.localPath}`);

            // Validar comprobante con IA
            console.log(`🤖 Iniciando análisis de IA para comprobante`);
            const validationResult: PaymentValidationResult = await this.paymentValidationService.validatePaymentReceipt(imageMetadata);

            // Procesar resultado de validación
            await this.processValidationResult(user, validationResult, imageMetadata);

            return true;
        } catch (error) {
            console.error('Error procesando imagen de comprobante:', error); await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ No pude procesar la imagen del comprobante.\n\n' +
                'Por favor verifica que:\n' +
                '• La imagen sea clara y legible\n' +
                '• Toda la información esté visible\n' +
                '• El formato sea JPG, PNG o similar\n\n' +
                'Intenta enviar la imagen nuevamente.'
            );
            return true;
        }
    }

    /**
     * Procesa el resultado de la validación y envía respuesta al usuario
     */
    private async processValidationResult(
        user: User,
        result: PaymentValidationResult,
        imageMetadata: ImageMetadata
    ): Promise<void> {
        if (result.isValid) {
            // Pago válido - crear ticket de verificación
            const ticketId = await this.createPaymentVerificationTicket(user, result, imageMetadata); await this.messageService.sendTextMessage(
                user.phoneNumber,
                `✅ **COMPROBANTE VÁLIDO**\n\n` +
                `🎯 **Detalles detectados:**\n` +
                `💰 Monto: $${result.extractedData.amount?.toLocaleString() || 'No detectado'}\n` +
                `📅 Fecha: ${result.extractedData.date || 'No detectada'}\n` +
                `🏦 Banco: ${result.extractedData.bank || 'No detectado'}\n` +
                `📊 Confianza: ${Math.round(result.confidence * 100)}%\n\n` +
                `📋 **Ticket creado:** #${ticketId}\n` +
                `⏱️ Tu pago será verificado en las próximas horas.\n\n` +
                `¡Gracias por tu pago! 🙏`
            );
        } else {
            // Pago no válido - informar problemas
            const errorsList = result.errors.join('\n• ');
            const suggestionsList = result.suggestions.join('\n• '); await this.messageService.sendTextMessage(
                user.phoneNumber,
                `❌ **COMPROBANTE NO VÁLIDO**\n\n` +
                `🚨 **Problemas detectados:**\n• ${errorsList}\n\n` +
                `💡 **Sugerencias:**\n• ${suggestionsList}\n\n` +
                `📋 **Cuentas autorizadas:**\n` +
                `${PaymentValidationService.getValidAccountsInfo()}\n\n` +
                `Por favor corrige estos problemas y envía un nuevo comprobante.`
            );
        }
    }    /**
     * Crea un ticket de verificación de pago
     */
    private async createPaymentVerificationTicket(
        user: User,
        result: PaymentValidationResult,
        imageMetadata: ImageMetadata
    ): Promise<string> {
        const ticketData = {
            customerId: user.customerId || user.phoneNumber,
            category: 'facturacion',
            description: `**SOLICITUD DE VERIFICACIÓN DE COMPROBANTE DE PAGO**\n\n` +
                `**Cliente:** ${user.phoneNumber}\n\n` +
                `**Detalles del Comprobante:**\n` +
                `• Monto: $${result.extractedData.amount?.toLocaleString() || 'No detectado'}\n` +
                `• Fecha: ${result.extractedData.date || 'No detectada'}\n` +
                `• Banco: ${result.extractedData.bank || 'No detectado'}\n` +
                `• Cuenta: ${result.extractedData.accountNumber || 'No detectada'}\n` +
                `• Referencia: ${result.extractedData.referenceNumber || 'No detectada'}\n` +
                `• Método: ${result.extractedData.paymentMethod || 'No detectado'}\n\n` +
                `**Validación IA:**\n` +
                `• Confianza: ${Math.round(result.confidence * 100)}%\n` +
                `• Calidad de imagen: ${result.validationDetails.imageQuality}\n\n` +
                `**Archivo:** ${imageMetadata.originalName}\n` +
                `**Ruta:** ${imageMetadata.localPath}\n\n` +
                `**ACCIÓN REQUERIDA:** Verificar manualmente el comprobante de pago y aplicar el pago correspondiente.`,
            priority: 'media' as const,
            source: 'whatsapp',
            metadata: {
                paymentValidation: result,
                imageMetadata: imageMetadata,
                automaticValidation: true
            }
        };

        return await this.ticketService.createTicket(ticketData);
    }

    /**
     * Maneja consultas de texto sobre comprobantes
     */
    private async handlePaymentInquiry(user: User, message: string): Promise<boolean> {
        const lowerMessage = message.toLowerCase(); if (lowerMessage.includes('comprobante') || lowerMessage.includes('pago')) {
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                `💳 **ENVÍO DE COMPROBANTES DE PAGO**\n\n` +
                `Para verificar tu pago, simplemente envía una **foto clara** de tu comprobante.\n\n` +
                `📋 **Cuentas autorizadas:**\n` +
                `${PaymentValidationService.getValidAccountsInfo()}\n\n` +
                `📸 **Tips para una buena foto:**\n` +
                `• Asegúrate de que esté bien iluminada\n` +
                `• Que se vea toda la información claramente\n` +
                `• Evita reflejos y sombras\n` +
                `• Formato JPG o PNG\n\n` +
                `¡Envía tu comprobante ahora! 📤`
            );
            return true;
        }

        return false;
    }
}

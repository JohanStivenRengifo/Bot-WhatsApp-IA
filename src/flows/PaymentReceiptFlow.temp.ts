import { ConversationFlow } from './ConversationFlow';
import { User, SessionData, WhatsAppMessage } from '../interfaces';
import { MessageService } from '../services/MessageService';
import { ImageStorageService, ImageMetadata } from '../services/ImageStorageService';
import { PaymentValidationService, PaymentValidationResult } from '../services/PaymentValidationService';
import { TicketService } from '../services/TicketService';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';
import { logMessageStructure, extractMediaId } from '../utils/debugUtils';

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
        // Si el flujo ya está activo (activado por ClientMenuFlow)
        if (session.flowActive === 'paymentReceipt') {
            return true;
        }

        // Si es un mensaje de texto sobre comprobantes
        if (typeof message === 'string') {
            // Mensajes exactos que siempre deben activar este flujo
            const exactMessages = [
                'validar pago',
                'subir comprobante de pago',
                'Validar Pago',
                'Subir comprobante de pago',
                'validar_pago',
                'comprobante_pago',
                'Validar Pago\nSubir comprobante de pago',
                '💳 Validar Pago',
                '💳 Validar Pago\nSubir comprobante de pago',
                // Variantes con espacios adicionales
                '💳 Validar Pago\n\nSubir comprobante de pago',
                '💳 Validar Pago\r\nSubir comprobante de pago',
                '💳 Validar Pago\r\n\r\nSubir comprobante de pago'
            ];

            if (exactMessages.includes(message.trim())) {
                console.log(`Mensaje exacto detectado para validación de pago: "${message}"`);
                return true;
            }

            // Verificar exactamente el mensaje enviado en la conversación
            if (message === '💳 Validar Pago\nSubir comprobante de pago' ||
                message.includes('💳 Validar Pago') && message.includes('Subir comprobante de pago')) {
                console.log(`Detectado mensaje interactivo de validación de pago: "${message}"`);
                return true;
            }

            // Normalizar el mensaje para detección (eliminar espacios y saltos de línea)
            const normalizedForDetection = message.replace(/\s+/g, ' ').trim();

            if (normalizedForDetection === '💳 Validar Pago Subir comprobante de pago' ||
                normalizedForDetection.includes('💳 Validar Pago') &&
                normalizedForDetection.includes('comprobante')) {
                console.log(`Mensaje normalizado detectado para validación de pago: "${normalizedForDetection}"`);
                return true;
            }

            // Verificar palabras clave en el mensaje normalizado
            const normalizedMessage = message.toLowerCase().trim();

            // Verificar frases específicas
            if (normalizedMessage.includes('validar pago') ||
                normalizedMessage.includes('subir comprobante') ||
                normalizedMessage.includes('comprobante de pago')) {
                console.log(`Frase clave detectada para validación de pago: "${normalizedMessage}"`);
                return true;
            }

            // Eliminar emojis para detectar mejor el texto
            const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
            const textWithoutEmojis = normalizedMessage.replace(emojiPattern, '').trim();

            if (textWithoutEmojis === 'validar pago' || textWithoutEmojis.includes('subir comprobante')) {
                console.log(`Texto sin emojis detectado para validación de pago: "${textWithoutEmojis}"`);
                return true;
            }

            // Verificar keywords relacionados con comprobantes usando isMenuCommand mejorado
            const keywordDetected = isMenuCommand(message, [
                'comprobante', 'pago', 'transferencia', 'factura',
                'comprobante_pago', 'subir comprobante', 'validar pago'
            ]);

            if (keywordDetected) {
                console.log(`Keywords detectados para validación de pago a través de isMenuCommand`);
                return true;
            }
        }

        // Si es un mensaje con imagen
        if (typeof message === 'object' && message.type === 'image') {
            console.log(`Imagen detectada para validación de pago - Estructura del mensaje:`, JSON.stringify(message, null, 2));
            // Registrar estructura del mensaje para depuración
            logMessageStructure(message, 'PaymentReceiptFlow.canHandle.image');
            return true;
        }

        // Verificar si es una imagen en cualquier formato conocido de WhatsApp
        if (typeof message === 'object' &&
            (message.type === 'image' ||
                message.type === 'document' ||
                (message.image && message.image.id) ||
                (message.document && message.document.id) ||
                (message.media && message.media.id))) {

            console.log(`Archivo/documento detectado para validación de pago`);
            logMessageStructure(message, 'PaymentReceiptFlow.canHandle.document');
            return true;
        }

        return false;
    }

    async handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        try {
            console.log(`PaymentReceiptFlow manejando mensaje para ${user.phoneNumber}`);

            // Establecer el flujo activo para asegurar que se maneje correctamente
            session.flowActive = 'paymentReceipt';

            // Manejar imagen de comprobante
            if (typeof message === 'object' &&
                (message.type === 'image' || message.type === 'document')) {

                console.log(`Procesando imagen o documento para ${user.phoneNumber}`);
                // Verificar estructura del mensaje
                logMessageStructure(message, 'PaymentReceiptFlow.handle');

                try {
                    const result = await this.handlePaymentReceiptImage(user, message);
                    // Limpiar estado de sesión después de procesar la imagen
                    session.flowActive = '';
                    return result;
                } catch (error) {
                    console.error(`Error procesando mensaje de tipo ${message.type}:`, error);
                    await this.messageService.sendTextMessage(
                        user.phoneNumber,
                        '❌ No pude procesar correctamente tu archivo.\n\n' +
                        'Por favor, envía una imagen en formato JPG o PNG que muestre claramente el comprobante de pago.'
                    );
                    session.flowActive = '';
                    return true;
                }
            }

            // Manejar mensajes de texto sobre comprobantes
            if (typeof message === 'string') {
                console.log(`Procesando consulta de texto sobre comprobante para ${user.phoneNumber}: "${message}"`);
                const result = await this.handlePaymentInquiry(user, message);
                // Si se procesó exitosamente una consulta, limpiar estado
                if (result) {
                    session.flowActive = '';
                    console.log(`Consulta de comprobante procesada exitosamente para ${user.phoneNumber}`);
                } else {
                    console.log(`No se pudo procesar la consulta de comprobante para ${user.phoneNumber}`);
                }
                return result;
            }

            console.log(`Mensaje no reconocido en PaymentReceiptFlow para ${user.phoneNumber}`);
            return false;
        } catch (error) {
            console.error('Error en PaymentReceiptFlow:', error);
            // Limpiar estado de sesión en caso de error
            session.flowActive = '';
            await this.messageService.sendTextMessage(
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
        try {
            // Enviar mensaje de procesamiento
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '📄 Recibido comprobante de pago. Analizando imagen...\n\nEsto puede tomar unos segundos.'
            );

            // Extraer ID de medio utilizando la utilidad centralizada
            const mediaId = extractMediaId(message);

            if (!mediaId) {
                console.error(`No se pudo extraer ID del medio para ${user.phoneNumber}`);
                logMessageStructure(message, 'PaymentReceiptFlow.handlePaymentReceiptImage.noMediaId');

                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '❌ No pude identificar el formato de la imagen. Por favor intenta enviarla nuevamente como archivo JPG o PNG.'
                );
                return true;
            }

            // Guardar imagen
            console.log(`📥 Guardando imagen de comprobante de ${user.phoneNumber} con ID: ${mediaId}`);
            const imageMetadata: ImageMetadata | null = await this.imageStorageService.downloadAndSaveImage(
                mediaId,
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
            console.error('Error procesando imagen de comprobante:', error);
            await this.messageService.sendTextMessage(
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
            const ticketId = await this.createPaymentVerificationTicket(user, result, imageMetadata);

            await this.messageService.sendTextMessage(
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
            const suggestionsList = result.suggestions.join('\n• ');

            await this.messageService.sendTextMessage(
                user.phoneNumber,
                `❌ **COMPROBANTE NO VÁLIDO**\n\n` +
                `🚨 **Problemas detectados:**\n• ${errorsList}\n\n` +
                `💡 **Sugerencias:**\n• ${suggestionsList}\n\n` +
                `📋 **Cuentas autorizadas:**\n` +
                `${PaymentValidationService.getValidAccountsInfo()}\n\n` +
                `Por favor corrige estos problemas y envía un nuevo comprobante.`
            );
        }
    }

    /**
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
        // Lista de mensajes exactos que deben activar la respuesta
        const exactMessages = [
            'validar pago',
            'subir comprobante de pago',
            'Validar Pago',
            'Subir comprobante de pago',
            'validar_pago',
            'comprobante_pago',
            'Validar Pago\nSubir comprobante de pago',
            '💳 Validar Pago',
            '💳 Validar Pago\nSubir comprobante de pago',
            // Variantes con espacios adicionales
            '💳 Validar Pago\n\nSubir comprobante de pago',
            '💳 Validar Pago\r\nSubir comprobante de pago',
            '💳 Validar Pago\r\n\r\nSubir comprobante de pago'
        ];

        // Comprobar si el mensaje coincide exactamente con alguno de los patrones
        if (exactMessages.includes(message.trim())) {
            console.log(`Mensaje exacto activó respuesta de comprobante: "${message}"`);
            await this.sendPaymentInstructions(user);
            return true;
        }

        // Comprobar si el mensaje coincide con el patrón después de normalizar saltos de línea
        const normalizedMessage = message.replace(/[\r\n]+/g, ' ').trim();
        if (normalizedMessage === '💳 Validar Pago Subir comprobante de pago' ||
            (normalizedMessage.includes('💳 Validar Pago') &&
                normalizedMessage.includes('Subir comprobante'))) {
            console.log(`Mensaje normalizado activó respuesta de comprobante: "${normalizedMessage}"`);
            await this.sendPaymentInstructions(user);
            return true;
        }

        // Procesar mensaje normalizado para casos más generales
        const lowerMessage = message.toLowerCase().trim();

        // Comprobar si el mensaje contiene palabras clave relacionadas con comprobantes de pago
        if (lowerMessage === 'validar_pago' ||
            lowerMessage === 'comprobante_pago' ||
            lowerMessage.includes('validar pago') ||
            lowerMessage.includes('subir comprobante') ||
            lowerMessage.includes('comprobante de pago') ||
            lowerMessage.includes('pago') ||
            lowerMessage.includes('💳')) {

            console.log(`Palabras clave activaron respuesta de comprobante: "${lowerMessage}"`);
            await this.sendPaymentInstructions(user);
            return true;
        }

        return false;
    }

    /**
     * Envía instrucciones para subir comprobante de pago
     */
    private async sendPaymentInstructions(user: User): Promise<void> {
        await this.messageService.sendTextMessage(
            user.phoneNumber,
            `💳 **VALIDACIÓN DE COMPROBANTES DE PAGO**\n\n` +
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
    }
}

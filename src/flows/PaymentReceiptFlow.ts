import { ConversationFlow } from './ConversationFlow';
import { User, SessionData, WhatsAppMessage } from '../interfaces';
import { MessageService } from '../services/MessageService';
import { ImageStorageService, ImageMetadata } from '../services/ImageStorageService';
import { PaymentValidationService, PaymentValidationResult } from '../services/PaymentValidationService';
import { TicketService } from '../services/TicketService';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';
import { logMessageStructure, extractMediaId, cleanMediaId } from '../utils/debugUtils';

export class PaymentReceiptFlow implements ConversationFlow {
    name = 'PaymentReceiptFlow';
    private messageService: MessageService;
    private imageStorageService: ImageStorageService;
    private paymentValidationService: PaymentValidationService;
    private ticketService: TicketService;

    constructor() {
        this.messageService = MessageService.getInstance();
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
                console.log(`✅ Mensaje exacto detectado para validación de pago: "${message}"`);
                return true;
            }

            // Detectar variaciones del comando con normalización
            const normalizedMessage = message.toLowerCase().trim();
            if (normalizedMessage.includes('validar') && normalizedMessage.includes('pago')) {
                console.log(`✅ Comando de validación de pago detectado: "${message}"`);
                return true;
            }

            if (normalizedMessage.includes('comprobante') && normalizedMessage.includes('pago')) {
                console.log(`✅ Comando de comprobante de pago detectado: "${message}"`);
                return true;
            }
        }

        // Si es una imagen y el flujo está esperando comprobantes
        if (typeof message === 'object' && message.type === 'image' && session.verifyingPayment) {
            console.log(`✅ Imagen recibida durante verificación de pago para ${user.phoneNumber}`);
            return true;
        }

        return false;
    }

    async handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        console.log(`PaymentReceiptFlow manejando mensaje para ${user.phoneNumber}`);

        // Registrar mensaje para depuración
        await logMessageStructure(message, 'PaymentReceiptFlow.handle');

        // Si es una imagen o documento, procesarla directamente
        if (typeof message === 'object' && (message.type === 'image' || message.type === 'document')) {
            console.log(`Procesando imagen o documento para ${user.phoneNumber}`);
            await this.handlePaymentReceiptImage(user, message, session);
            return true;
        }

        // Si es un mensaje de texto, responder con información sobre comprobantes
        if (typeof message === 'string') {
            console.log(`Procesando consulta de texto sobre comprobante para ${user.phoneNumber}: "${message}"`);
            await this.handlePaymentReceiptQuery(user, message, session);
            return true;
        }

        return false;
    }

    private async handlePaymentReceiptQuery(user: User, message: string, session: SessionData): Promise<void> {
        // Activar el flujo para que las próximas imágenes sean procesadas
        session.flowActive = 'paymentReceipt';
        session.verifyingPayment = true;
        session.lastActivity = new Date();

        // Mensajes que indican solicitud de información sobre pagos
        const informationMessages = [
            'validar pago', 'subir comprobante de pago', 'Validar Pago', 'Subir comprobante de pago',
            'validar_pago', 'comprobante_pago', '💳 Validar Pago'
        ];

        if (informationMessages.some(msg => message.includes(msg))) {
            console.log(`Mensaje exacto activó respuesta de comprobante: "${message}"`);

            const responseMessage = `💳 **VALIDACIÓN DE COMPROBANTES DE PAGO**            📄 Para validar tu pago, por favor envía una **FOTO CLARA** de tu comprobante que incluya:

✅ **Información requerida:**
• Fecha y hora de la transacción
• Monto pagado
• Número de referencia o CUS
• Nombre del banco o entidad

🏦 **Medios de pago aceptados:**

🏛️ **CORRESPONSAL BANCOLOMBIA ó APP**
• CONVENIO 94375 más TU CODIGO USUARIO

🏦 **BANCOLOMBIA AHORROS**
• Cuenta: 26100006596
• NIT: 901707684
• Conecta2 Telecomunicaciones

💜 **NEQUI**
• Número: 3242156679

🏦 **DAVIVIENDA AHORROS**
• Cuenta: 0488403242917

📲 **IMPORTANTE:**
• La imagen debe verse claramente
• Incluye toda la información del comprobante
• Envía solo UNA imagen por comprobante
• ENVIAR FOTO DEL COMPROBANTE PARA VALIDAR EL PAGO WhatsApp 3242156679

⚠️ **RECONEXION DE $7.000 DESPUES DEL DIA 15**
💳 **La imagen adjunta es un QR de pago**

¿Tienes tu comprobante listo? ¡Envíalo como foto! 📸`;

            await this.messageService.sendTextMessage(user.phoneNumber, responseMessage);
            console.log(`Consulta de comprobante procesada exitosamente para ${user.phoneNumber}`);
            return;
        }

        // Respuesta por defecto con información sobre el proceso
        const helpMessage = `💳 **SUBIR COMPROBANTE DE PAGO**

Para validar tu pago:

1️⃣ Toma una foto clara de tu comprobante
2️⃣ Asegúrate que se vea toda la información
3️⃣ Envíala aquí mismo

📋 **Debe incluir:**
• Fecha y hora
• Monto pagado  
• Referencia bancaria
• Nombre del banco

¿Tienes alguna duda? ¡Envía tu comprobante y lo validamos! 📸`;

        await this.messageService.sendTextMessage(user.phoneNumber, helpMessage);
    }

    private async handlePaymentReceiptImage(user: User, message: WhatsAppMessage, session: SessionData): Promise<void> {
        try {
            // Enviar mensaje de procesamiento inmediatamente
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                "📄 Recibido comprobante de pago. Analizando imagen...\n\nEsto puede tomar unos segundos."
            );

            // Extraer el Media ID de la imagen
            const mediaId = extractMediaId(message);
            if (!mediaId) {
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    "❌ Error: No se pudo obtener la imagen. Por favor, intenta enviarla nuevamente."
                );
                return;
            } console.log(`📥 Guardando imagen de comprobante de ${user.phoneNumber} con ID: ${mediaId}`);

            // Intentar descargar la imagen con reintentos para manejar Media IDs expirados
            const imageMetadata = await this.downloadImageWithRetries(user, mediaId);

            // Validar el comprobante de pago usando el servicio de validación
            const validationResult = await this.paymentValidationService.validatePaymentReceipt(
                imageMetadata
            );

            // Procesar resultado de la validación
            await this.processValidationResult(user, validationResult, session);

        } catch (error) {
            console.error('Error procesando imagen de comprobante:', error);

            // Manejar diferentes tipos de errores específicos de Media IDs expirados
            if (error instanceof Error &&
                (error.message.includes('Object with ID') && error.message.includes('does not exist'))) {

                const errorMessage = `⏰ **MEDIA ID EXPIRADO**

Lo siento, la imagen que enviaste ha expirado en los servidores de WhatsApp.

📱 **Por favor:**
1. Envía la imagen **nuevamente**
2. Asegúrate de enviarla inmediatamente después de tomarla

🔄 **¿Por qué sucede esto?**
• Las imágenes en WhatsApp tienen un tiempo limitado de disponibilidad (5 minutos según la documentación oficial)
• Esto es por seguridad y privacidad

¡Envía tu comprobante de nuevo! 📸`;

                await this.messageService.sendTextMessage(user.phoneNumber, errorMessage);
            } else {
                // Error genérico
                const errorMessage = `❌ **Error procesando comprobante**

Hubo un problema al procesar tu imagen. Por favor:

1️⃣ Verifica que la imagen sea clara
2️⃣ Asegúrate que muestre toda la información
3️⃣ Intenta enviarla nuevamente

Si el problema persiste, contacta a nuestro equipo de soporte.`;

                await this.messageService.sendTextMessage(user.phoneNumber, errorMessage);
            }
        }
    }    /**
     * Intenta descargar la imagen con reintentos para manejar Media IDs expirados
     * Implementa las mejores prácticas según la documentación oficial de WhatsApp Business API v23.0
     */
    private async downloadImageWithRetries(user: User, mediaId: string, maxRetries: number = 2): Promise<ImageMetadata> {
        let lastError: Error = new Error('Unknown error');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📥 Descargando imagen ${mediaId} para usuario ${user.phoneNumber} (intento ${attempt}/${maxRetries})`);

                const imageMetadata = await this.imageStorageService.downloadAndSaveImage(
                    mediaId,
                    user.phoneNumber,
                    'payment_receipt'
                );

                // Si el servicio retorna null, tratar como error
                if (!imageMetadata) {
                    throw new Error('ImageStorageService returned null');
                }

                console.log(`✅ Imagen descargada exitosamente en el intento ${attempt}`);
                return imageMetadata;

            } catch (error) {
                lastError = error as Error;
                console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, (error as Error).message);

                // Manejar errores específicos de Media ID expirado (400 Bad Request)
                if ((error as any).response?.status === 400) {
                    const errorData = (error as any).response.data;
                    console.log(`📋 Datos de respuesta:`, errorData);

                    // Verificar si es un error de Media ID expirado según la documentación v23.0
                    const errorMessage = JSON.stringify(errorData).toLowerCase();
                    if ((errorMessage.includes('object with id') && errorMessage.includes('does not exist')) ||
                        errorMessage.includes('media not found') ||
                        errorMessage.includes('invalid media id') ||
                        errorMessage.includes('missing permissions') ||
                        errorMessage.includes('unsupported get request')) {

                        console.log(`🔍 Media ID expirado detectado en intento ${attempt}/${maxRetries}`);

                        // No reintentar para Media IDs expirados - lanzar error inmediatamente
                        console.log(`❌ Media ID definitivamente expirado: ${mediaId}`);
                        const expiredError = new Error(`Object with ID '${mediaId}' does not exist`);
                        throw expiredError;
                    }
                }

                // Manejar errores 404 (Media no encontrado)
                if ((error as any).response?.status === 404) {
                    console.log(`❌ Media ID no encontrado (404): ${mediaId}`);
                    const notFoundError = new Error(`Media not found: ${mediaId}`);
                    notFoundError.message = 'Object with ID \'' + mediaId + '\' does not exist';
                    throw notFoundError;
                }

                // Si es el último intento para otros errores, lanzar el error
                if (attempt === maxRetries) {
                    console.error(`❌ Máximo número de intentos alcanzado (${maxRetries})`);
                    throw lastError;
                }

                // Esperar antes del próximo intento para otros errores
                console.log(`⏰ Esperando antes del intento ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.error(`❌ Falló después de ${maxRetries} intentos`);
        throw lastError;
    }

    private async processValidationResult(
        user: User,
        validationResult: PaymentValidationResult,
        session: SessionData
    ): Promise<void> {
        if (validationResult.isValid) {
            try {
                // Crear ticket automáticamente para pago válido
                const ticketData = {
                    customerId: user.phoneNumber, // Usando phoneNumber como customerId según la interfaz
                    category: 'Pago',
                    priority: 'media' as const,
                    description: `Comprobante de pago validado - ${validationResult.confidence || 'Verificado'}`,
                    source: 'whatsapp_bot', metadata: {
                        paymentReceipt: true,
                        imageInfo: validationResult.confidence ? `Confianza: ${validationResult.confidence}` : 'Análisis completado',
                        userId: user.phoneNumber,
                        timestamp: new Date().toISOString()
                    }
                };

                const ticket = await this.ticketService.createTicket(ticketData);

                const successMessage = `✅ **COMPROBANTE VALIDADO EXITOSAMENTE**

🎉 Tu pago ha sido verificado y registrado correctamente.

📊 **Detalles:**
• Validación: Exitosa
• Estado: Procesado
${validationResult.confidence ? `• Confianza: ${validationResult.confidence}` : '• Información detectada correctamente'}

📋 **Ticket Creado:** #${ticket}

⚡ **Próximos pasos:**
• Tu pago será procesado en las próximas horas
• Recibirás confirmación una vez aplicado a tu cuenta
• Puedes consultar el estado con el ticket #${ticket}

¡Gracias por tu pago! 🙏`;

                await this.messageService.sendTextMessage(user.phoneNumber, successMessage);

                // Finalizar el flujo
                session.flowActive = undefined;
                session.verifyingPayment = false;

            } catch (ticketError) {
                console.error('Error creando ticket:', ticketError);

                const partialSuccessMessage = `✅ **COMPROBANTE VALIDADO**

🎉 Tu pago ha sido verificado correctamente.

⚠️ Hubo un problema menor al crear el ticket de seguimiento, pero tu pago está registrado.

Nuestro equipo procesará tu pago manualmente. ¡Gracias! 🙏`;

                await this.messageService.sendTextMessage(user.phoneNumber, partialSuccessMessage);
                session.flowActive = undefined;
                session.verifyingPayment = false;
            }

        } else {
            // Pago no válido
            const rejectionMessage = `❌ **COMPROBANTE NO VÁLIDO**

🔍 **Motivo:**
${validationResult.confidence || 'No se pudo validar el comprobante de pago.'}

📝 **Por favor verifica que tu comprobante incluya:**
• Fecha y hora de la transacción
• Monto pagado completo
• Número de referencia bancaria
• Información clara y legible

🔄 **¿Necesitas ayuda?**
Puedes enviar otro comprobante o contactar a nuestro equipo de soporte.`;

            await this.messageService.sendTextMessage(user.phoneNumber, rejectionMessage);
        }
    }
}

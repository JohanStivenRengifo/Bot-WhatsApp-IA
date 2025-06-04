import { WhatsAppMessage, SessionData } from '../interfaces/WhatsAppMessage';
import { User } from '../interfaces/User';
import { MessageService } from '../services/MessageService';
import { AIService } from '../services/AIService';
import { CustomerService } from '../services/CustomerService';
import { ConversationFlow } from './ConversationFlow';

interface PaymentPointSession extends SessionData {
    consultingPaymentPoints?: boolean;
}

export class PaymentPointsFlow implements ConversationFlow {
    readonly name = 'PaymentPointsFlow';

    private messageService: MessageService;
    private aiService: AIService;
    private customerService: CustomerService;

    constructor(messageService: MessageService, aiService: AIService, customerService: CustomerService) {
        this.messageService = messageService;
        this.aiService = aiService;
        this.customerService = customerService;
    }

    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const paymentSession = session as PaymentPointSession;
        return message.toLowerCase().trim() === 'puntos_pago' ||
            paymentSession.consultingPaymentPoints === true;
    }

    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const paymentSession = session as PaymentPointSession;
        const mockMessage: WhatsAppMessage = {
            from: user.phoneNumber,
            id: `msg_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'text',
            text: { body: message }
        };

        return await this.handleMessage(mockMessage, paymentSession);
    } async handleMessage(message: WhatsAppMessage, session: PaymentPointSession): Promise<boolean> {
        const userMessage = message.text?.body?.toLowerCase().trim();

        if (!session.consultingPaymentPoints && userMessage === 'puntos_pago') {
            return await this.showPaymentMethods(message, session);
        }

        if (session.consultingPaymentPoints) {
            return await this.handlePaymentOptions(message, session, userMessage || '');
        }

        return false;
    }

    private async showPaymentMethods(message: WhatsAppMessage, session: PaymentPointSession): Promise<boolean> {
        session.consultingPaymentPoints = true;

        const paymentMessage = `
💳 *MEDIOS DE PAGO ELECTRÓNICOS*

📱 *CORRESPONSAL BANCOLOMBIA ó APP*
**CONVENIO:** 94375 + TU CÓDIGO USUARIO

🏦 *BANCOLOMBIA AHORROS*
**Cuenta:** 26100006596
**NIT:** 901707684
**Titular:** Conecta2 Telecomunicaciones

💜 *NEQUI*
**Número:** 3242156679

🏛️ *DAVIVIENDA AHORROS*
**Cuenta:** 0488403242917

📷 *VALIDACIÓN DE PAGO:*
Enviar foto del comprobante para validar el pago
**WhatsApp:** 3242156679

⚠️ *IMPORTANTE:*
**RECONEXIÓN DE $7.000 DESPUÉS DEL DÍA 15**

*¿Necesitas ayuda con algún método de pago?*

*1️⃣ Ayuda con Bancolombia*
*2️⃣ Ayuda con Nequi*
*3️⃣ Ayuda con Davivienda*
*4️⃣ Enviar comprobante*
*5️⃣ Información de reconexión*
*0️⃣ Regresar al menú principal*`;

        await this.messageService.sendTextMessage(message.from, paymentMessage);
        return true;
    }

    private async handlePaymentOptions(
        message: WhatsAppMessage,
        session: PaymentPointSession,
        userMessage: string
    ): Promise<boolean> {
        switch (userMessage) {
            case '0':
                session.consultingPaymentPoints = false;
                await this.messageService.sendTextMessage(message.from, "Has regresado al menú principal. ¿En qué más puedo ayudarte?");
                return true;

            case '1':
                return await this.showBancolombiaHelp(message);

            case '2':
                return await this.showNequiHelp(message);

            case '3':
                return await this.showDaviviendaHelp(message);

            case '4':
                return await this.showReceiptInstructions(message);

            case '5':
                return await this.showReconnectionInfo(message); default:
                await this.messageService.sendTextMessage(
                    message.from,
                    "❌ Opción no válida. Por favor selecciona un número del 1 al 5, o 0 para regresar al menú principal."
                );
                return true;
        }
    }

    private async showBancolombiaHelp(message: WhatsAppMessage): Promise<boolean> {
        const bancolombiaHelp = `
🏦 *AYUDA BANCOLOMBIA*

**📱 CORRESPONSAL BANCOLOMBIA:**
1. Busca "Corresponsal Bancolombia" en tu app
2. Selecciona "Pagar servicios"
3. Ingresa convenio: **94375**
4. Ingresa tu código de usuario
5. Confirma el monto a pagar

**🏪 PUNTOS FÍSICOS:**
• Tiendas con logo Bancolombia
• Cajeros automáticos
• Sucursales bancarias

**💰 TRANSFERENCIA DIRECTA:**
• Cuenta Ahorros: **26100006596**
• Titular: Conecta2 Telecomunicaciones
• NIT: 901707684

¿Necesitas más información sobre algún método?

*Escribe REGRESAR para volver al menú de pagos*`;

        await this.messageService.sendTextMessage(message.from, bancolombiaHelp);
        return true;
    }

    private async showNequiHelp(message: WhatsAppMessage): Promise<boolean> {
        const nequiHelp = `
💜 *AYUDA NEQUI*

**📲 PASOS PARA PAGAR:**
1. Abre tu app Nequi
2. Selecciona "Enviar plata"
3. Busca el número: **3242156679**
4. Ingresa el monto de tu factura
5. Agrega como referencia tu código de usuario
6. Confirma el envío

**📋 DATOS IMPORTANTES:**
• Número Nequi: **3242156679**
• Siempre incluye tu código como referencia
• Disponible 24/7

**✅ DESPUÉS DEL PAGO:**
Envía captura del comprobante al WhatsApp **3242156679**

¿Tienes alguna duda sobre el proceso?

*Escribe REGRESAR para volver al menú de pagos*`;

        await this.messageService.sendTextMessage(message.from, nequiHelp);
        return true;
    }

    private async showDaviviendaHelp(message: WhatsAppMessage): Promise<boolean> {
        const daviviendaHelp = `
🏛️ *AYUDA DAVIVIENDA*

**🏦 TRANSFERENCIA BANCARIA:**
• Cuenta Ahorros: **0488403242917**
• Titular: Conecta2 Telecomunicaciones
• Banco: Davivienda

**📱 APP DAVIPLATA:**
1. Selecciona "Transferir"
2. Elige "A cuenta Davivienda"
3. Ingresa la cuenta: **0488403242917**
4. Confirma el monto
5. Incluye tu código en la descripción

**🏪 PUNTOS DAVIVIENDA:**
• Sucursales bancarias
• Cajeros automáticos
• Corresponsales autorizados

**⚠️ IMPORTANTE:**
Envía comprobante al WhatsApp **3242156679** para validar tu pago

¿Necesitas más detalles?

*Escribe REGRESAR para volver al menú de pagos*`;

        await this.messageService.sendTextMessage(message.from, daviviendaHelp);
        return true;
    }

    private async showReceiptInstructions(message: WhatsAppMessage): Promise<boolean> {
        const receiptInstructions = `
📷 *ENVÍO DE COMPROBANTE*

**📲 WHATSAPP PARA COMPROBANTES:**
**3242156679**

**📋 INFORMACIÓN REQUERIDA:**
✅ Foto clara del comprobante
✅ Tu código de usuario
✅ Monto pagado
✅ Fecha del pago
✅ Método utilizado (Nequi, Bancolombia, etc.)

**⏰ HORARIO DE VALIDACIÓN:**
Lunes a Viernes: 8:00 AM - 6:00 PM
Sábados: 8:00 AM - 2:00 PM

**⚡ TIEMPO DE PROCESAMIENTO:**
• Pagos en horario laboral: 1-2 horas
• Pagos fuera de horario: Siguiente día hábil

**📱 EJEMPLO DE MENSAJE:**
"Hola, envío comprobante de pago
Código: [TU_CÓDIGO]
Monto: $[CANTIDAD]
Método: [BANCO/NEQUI]"

¿Todo claro?

*Escribe REGRESAR para volver al menú de pagos*`;

        await this.messageService.sendTextMessage(message.from, receiptInstructions);
        return true;
    }

    private async showReconnectionInfo(message: WhatsAppMessage): Promise<boolean> {
        const reconnectionInfo = `
⚠️ *INFORMACIÓN DE RECONEXIÓN*

**💰 COSTO DE RECONEXIÓN:**
**$7.000 DESPUÉS DEL DÍA 15**

**📅 ¿CUÁNDO SE COBRA?**
• Si pagas después del día 15 del mes
• Se suma automáticamente a tu factura
• Aplica para todos los servicios suspendidos

**🔄 PROCESO DE RECONEXIÓN:**
1. Realiza el pago completo (factura + reconexión)
2. Envía comprobante al **3242156679**
3. Validamos tu pago (1-2 horas hábiles)
4. Activamos tu servicio automáticamente

**⏰ TIEMPO DE ACTIVACIÓN:**
• Pagos validados: 30 minutos - 2 horas
• Reconexión técnica: Máximo 24 horas

**💡 CONSEJO:**
Para evitar costo de reconexión, paga antes del día 15 de cada mes

**🆘 ¿PROBLEMAS CON LA RECONEXIÓN?**
Contacta soporte técnico desde el menú principal

¿Tienes más preguntas?

*Escribe REGRESAR para volver al menú de pagos*`;

        await this.messageService.sendTextMessage(message.from, reconnectionInfo);
        return true;
    }

    async cleanup(session: PaymentPointSession): Promise<void> {
        session.consultingPaymentPoints = false;
    }
}
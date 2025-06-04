import { WhatsAppMessage, SessionData } from '../interfaces/WhatsAppMessage';
import { User } from '../interfaces/User';
import { MessageService } from '../services/MessageService';
import { AIService } from '../services/AIService';
import { CustomerService } from '../services/CustomerService';
import { ConversationFlow } from './ConversationFlow';

interface AdvisorTransferSession extends SessionData {
    transferringToAdvisor?: boolean;
    transferReason?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    userPreference?: string;
    waitingForTransfer?: boolean;
    estimatedWaitTime?: number;
    transferId?: string;
    currentStep?: number;
    customerName?: string;
    customerCode?: string;
}

export class AdvisorTransferFlow implements ConversationFlow {
    readonly name = 'AdvisorTransferFlow';

    private messageService: MessageService;
    private aiService: AIService;
    private customerService: CustomerService;

    constructor(messageService: MessageService, aiService: AIService, customerService: CustomerService) {
        this.messageService = messageService;
        this.aiService = aiService;
        this.customerService = customerService;
    }

    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const transferSession = session as AdvisorTransferSession;
        return message.toLowerCase().trim() === 'transferencia_asesor' ||
            transferSession.transferringToAdvisor === true ||
            transferSession.waitingForTransfer === true;
    }

    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const transferSession = session as AdvisorTransferSession;
        const mockMessage: WhatsAppMessage = {
            from: user.phoneNumber,
            id: `msg_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'text',
            text: { body: message }
        };

        return await this.handleMessage(mockMessage, transferSession);
    }

    async handleMessage(message: WhatsAppMessage, session: AdvisorTransferSession): Promise<boolean> {
        const userMessage = message.text?.body?.toLowerCase().trim();

        if (!session.transferringToAdvisor && userMessage === 'transferencia_asesor') {
            return await this.startTransferProcess(message, session);
        }

        if (session.transferringToAdvisor && !session.waitingForTransfer) {
            return await this.processTransferDetails(message, session, userMessage || '');
        }

        if (session.waitingForTransfer) {
            return await this.handleWaitingState(message, session, userMessage || '');
        }

        return false;
    }

    private async startTransferProcess(message: WhatsAppMessage, session: AdvisorTransferSession): Promise<boolean> {
        session.transferringToAdvisor = true;
        session.currentStep = 0;
        session.customerName = session.customerName || 'Cliente';
        session.customerCode = session.customerCode || 'N/A';

        const transferOptions = `
🤝 *TRANSFERENCIA A ASESOR HUMANO*

Te conectaré con un asesor especializado. Para asignarte al más adecuado, por favor selecciona el tipo de consulta:

*1️⃣ Soporte técnico*
*2️⃣ Problemas de conexión*  
*3️⃣ Facturación y pagos*
*4️⃣ Instalaciones nuevas*
*5️⃣ Quejas y reclamos*
*6️⃣ Cambios de plan*

*0️⃣ Regresar*

_Responde con el número de tu opción_`;

        await this.messageService.sendTextMessage(message.from, transferOptions);
        return true;
    }

    private async processTransferDetails(
        message: WhatsAppMessage,
        session: AdvisorTransferSession,
        userMessage: string
    ): Promise<boolean> {
        switch (session.currentStep) {
            case 0:
                return await this.handleTransferType(message, session, userMessage);
            case 1:
                return await this.handlePrioritySelection(message, session, userMessage);
            case 2:
                return await this.handleAdditionalDetails(message, session, userMessage);
            case 3:
                return await this.initiateTransfer(message, session);
            default:
                return false;
        }
    }

    private async handleTransferType(message: WhatsAppMessage, session: AdvisorTransferSession, userMessage: string): Promise<boolean> {
        const transferTypes = {
            '1': { reason: 'Soporte técnico', department: 'technical', priority: 'high' },
            '2': { reason: 'Problemas de conexión', department: 'technical', priority: 'high' },
            '3': { reason: 'Facturación y pagos', department: 'billing', priority: 'medium' },
            '4': { reason: 'Instalaciones nuevas', department: 'installations', priority: 'high' },
            '5': { reason: 'Quejas y reclamos', department: 'complaints', priority: 'urgent' },
            '6': { reason: 'Cambios de plan', department: 'sales', priority: 'medium' }
        };

        if (userMessage === '0') {
            session.transferringToAdvisor = false;
            await this.messageService.sendTextMessage(message.from, "Has regresado al menú anterior. ¿En qué más puedo ayudarte?");
            return true;
        }

        const selectedType = transferTypes[userMessage as keyof typeof transferTypes];
        if (!selectedType) {
            await this.messageService.sendTextMessage(
                message.from,
                "❌ Opción no válida. Por favor selecciona un número del 1 al 6, o 0 para regresar."
            );
            return true;
        }

        session.transferReason = selectedType.reason;
        session.priority = selectedType.priority as 'low' | 'medium' | 'high' | 'urgent';
        session.currentStep = 1;

        const priorityMessage = `
✅ *${selectedType.reason}* seleccionado.

Para determinar la urgencia de tu consulta:

*1️⃣ Baja* - Consulta general, no urgente
*2️⃣ Media* - Necesito ayuda pronto
*3️⃣ Alta* - Problema que afecta mi servicio
*4️⃣ Urgente* - Sin servicio/problema crítico

¿Cuál es la urgencia de tu consulta?`;

        await this.messageService.sendTextMessage(message.from, priorityMessage);
        return true;
    }

    private async handlePrioritySelection(message: WhatsAppMessage, session: AdvisorTransferSession, userMessage: string): Promise<boolean> {
        const priorities = {
            '1': 'low',
            '2': 'medium',
            '3': 'high',
            '4': 'urgent'
        };

        const selectedPriority = priorities[userMessage as keyof typeof priorities];
        if (!selectedPriority) {
            await this.messageService.sendTextMessage(
                message.from,
                "❌ Opción no válida. Selecciona del 1 al 4 según la urgencia."
            );
            return true;
        }

        session.priority = selectedPriority as 'low' | 'medium' | 'high' | 'urgent';
        session.currentStep = 2;

        const detailsMessage = `
Perfecto. Para preparar mejor tu transferencia, por favor describe brevemente tu consulta o problema:

_Ejemplo: "Mi internet está muy lento desde ayer" o "Quiero cambiar mi plan a uno más rápido"_

*Escribe tu consulta o escribe "omitir" para continuar sin detalles:*`;

        await this.messageService.sendTextMessage(message.from, detailsMessage);
        return true;
    }

    private async handleAdditionalDetails(message: WhatsAppMessage, session: AdvisorTransferSession, userMessage: string): Promise<boolean> {
        if (userMessage !== 'omitir') {
            session.userPreference = message.text?.body || '';
        }

        session.currentStep = 3;
        return await this.initiateTransfer(message, session);
    }

    private async initiateTransfer(message: WhatsAppMessage, session: AdvisorTransferSession): Promise<boolean> {
        // Generar ID único para la transferencia
        session.transferId = `TXF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // Calcular tiempo estimado de espera basado en prioridad
        const waitTimes = {
            urgent: { min: 1, max: 3 },
            high: { min: 3, max: 8 },
            medium: { min: 5, max: 15 },
            low: { min: 10, max: 25 }
        };

        const timeRange = waitTimes[session.priority!];
        session.estimatedWaitTime = Math.floor(Math.random() * (timeRange.max - timeRange.min + 1)) + timeRange.min;

        // Simular creación de ticket de transferencia
        const transferData = {
            transferId: session.transferId,
            customerCode: session.customerCode,
            customerName: session.customerName,
            reason: session.transferReason,
            priority: session.priority,
            details: session.userPreference || 'Sin detalles adicionales',
            phone: message.from,
            timestamp: new Date().toISOString()
        };

        // En un sistema real, aquí se registraría en la cola de asesores
        console.log('Transfer request created:', transferData);

        const fullMessage = `
✅ *TRANSFERENCIA PROCESADA EXITOSAMENTE*

Tu solicitud ha sido enviada al departamento correspondiente y serás contactado por un asesor especializado.

📋 *Resumen de tu solicitud:*
• **ID:** ${session.transferId}
• **Tipo:** ${session.transferReason}
• **Prioridad:** ${this.getPriorityText(session.priority!)}
• **Tiempo estimado:** ${session.estimatedWaitTime} minutos

🔄 *Opciones mientras esperas:*
*1️⃣ Consultar estado de transferencia*
*2️⃣ Cancelar transferencia*
*3️⃣ Regresar al menú principal*

_Un asesor especializado se pondrá en contacto contigo pronto._`;

        await this.messageService.sendTextMessage(message.from, fullMessage);

        session.waitingForTransfer = true;
        session.transferringToAdvisor = false;

        // Simular notificación al sistema de asesores
        setTimeout(() => {
            this.simulateAdvisorNotification(session, message.from);
        }, session.estimatedWaitTime * 60 * 1000); // Convertir minutos a milisegundos

        return true;
    }

    private async handleWaitingState(message: WhatsAppMessage, session: AdvisorTransferSession, userMessage: string): Promise<boolean> {
        switch (userMessage) {
            case '1':
                return await this.checkTransferStatus(message, session);
            case '2':
                return await this.cancelTransfer(message, session);
            case '3':
                session.waitingForTransfer = false;
                session.transferringToAdvisor = false;
                await this.messageService.sendTextMessage(message.from, "Has regresado al menú principal. Tu transferencia sigue activa y serás contactado cuando esté disponible.");
                return true;
            default:
                await this.messageService.sendTextMessage(message.from, `Mientras esperas a tu asesor, puedes:

🔄 *Opciones disponibles:*
*1️⃣ Consultar estado*
*2️⃣ Cancelar transferencia*
*3️⃣ Menú principal*`);
                return true;
        }
    }

    private async checkTransferStatus(message: WhatsAppMessage, session: AdvisorTransferSession): Promise<boolean> {
        const currentTime = new Date();
        const transferTime = new Date(session.lastActivity || Date.now());
        const elapsedMinutes = Math.floor((currentTime.getTime() - transferTime.getTime()) / (1000 * 60));
        const remainingTime = Math.max(0, session.estimatedWaitTime! - elapsedMinutes);

        const statusMessage = `
📊 *Estado de tu transferencia:*

• **ID:** ${session.transferId}
• **Tipo:** ${session.transferReason}
• **Estado:** ${remainingTime > 0 ? '⏳ En cola' : '🔄 Procesando'}
• **Tiempo transcurrido:** ${elapsedMinutes} min
• **Tiempo restante:** ${remainingTime > 0 ? `~${remainingTime} min` : 'Muy pronto'}

${remainingTime > 0 ?
                '⏰ Te contactaremos dentro del tiempo estimado.' :
                '🚀 Tu caso está siendo revisado por un asesor.'}

*1️⃣ Actualizar estado*
*2️⃣ Cancelar transferencia*
*3️⃣ Regresar*`;

        await this.messageService.sendTextMessage(message.from, statusMessage);
        return true;
    }

    private async cancelTransfer(message: WhatsAppMessage, session: AdvisorTransferSession): Promise<boolean> {
        const confirmMessage = `
❓ ¿Estás seguro de que quieres cancelar tu transferencia?

**ID:** ${session.transferId}
**Motivo:** ${session.transferReason}

*1️⃣ Sí, cancelar transferencia*
*2️⃣ No, mantener transferencia*

_Si cancelas, perderás tu lugar en la cola._`;

        await this.messageService.sendTextMessage(message.from, confirmMessage);

        // Para simplificar, cancelamos directamente por ahora
        session.waitingForTransfer = false;
        session.transferringToAdvisor = false;
        session.transferId = undefined;

        await this.messageService.sendTextMessage(message.from, "✅ Tu transferencia ha sido cancelada. ¿Hay algo más en lo que pueda ayudarte?");
        return true;
    }

    private async simulateAdvisorNotification(session: AdvisorTransferSession, phoneNumber: string): Promise<void> {
        // En un sistema real, aquí se notificaría al sistema de asesores
        const advisorNames = ['Ana García', 'Carlos Rodríguez', 'María López', 'Diego Martínez', 'Sofía Hernández'];
        const selectedAdvisor = advisorNames[Math.floor(Math.random() * advisorNames.length)];

        const notificationMessage = `
👨‍💼 *¡Tu asesor está disponible!*

**${selectedAdvisor}** - Especialista en ${session.transferReason?.toLowerCase()}

Tu caso será atendido en los próximos minutos. El asesor se pondrá en contacto contigo directamente.

**ID de transferencia:** ${session.transferId}

_Gracias por tu paciencia._`;

        setTimeout(async () => {
            await this.messageService.sendTextMessage(phoneNumber, notificationMessage);
        }, 2000);
    }

    private getPriorityText(priority: string): string {
        const priorityTexts = {
            low: '🟢 Baja',
            medium: '🟡 Media',
            high: '🟠 Alta',
            urgent: '🔴 Urgente'
        };
        return priorityTexts[priority as keyof typeof priorityTexts] || priority;
    }

    async cleanup(session: AdvisorTransferSession): Promise<void> {
        session.transferringToAdvisor = false;
        session.transferReason = undefined;
        session.priority = undefined;
        session.userPreference = undefined;
        session.waitingForTransfer = false;
        session.estimatedWaitTime = undefined;
        session.transferId = undefined;
        session.currentStep = undefined;
    }
}

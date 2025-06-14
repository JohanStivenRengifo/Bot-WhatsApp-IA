import { BaseConversationFlow } from './ConversationFlow';
import { User, SessionData, WhatsAppMessage, WhatsAppHandoverEvent } from '../interfaces';
import { MessageService } from '../services/MessageService';
import { SecurityService } from '../services/SecurityService';
import { TicketService } from '../services/TicketService';
import { CRMServiceMongoDB } from '../services/CRMServiceMongoDB';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

/**
 * Flujo para transferir conversación a agente humano
 * Integra con Meta Handover Protocol para CRM futuro
 */
export class AgentHandoverFlow extends BaseConversationFlow {
    readonly name = 'AgentHandoverFlow';
    private crmService: CRMServiceMongoDB;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        private ticketService: TicketService
    ) {
        super(messageService, securityService);
        this.crmService = CRMServiceMongoDB.getInstance();
    } async canHandle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        // Solo manejar mensajes de texto para este flujo
        if (typeof message !== 'string') return false;

        // Si el flujo ya está activo (activado por ClientMenuFlow)
        if (session.flowActive === 'agentHandover') {
            return true;
        }

        const extractedCommand = extractMenuCommand(message);
        const messageLower = message.toLowerCase().trim();

        // PRIORIDAD ALTA: Comandos directos de agente
        if (extractedCommand === 'hablar_agente' || extractedCommand === 'agente' || extractedCommand === 'soporte_humano') {
            console.log(`🎯 AgentHandoverFlow: Comando directo detectado: ${extractedCommand}`);
            return true;
        }

        // Detectar múltiples intentos de "asesor"
        if (messageLower.includes('asesor')) {
            if (!session.advisorAttempts) {
                session.advisorAttempts = 0;
            }
            session.advisorAttempts++;

            console.log(`🔄 AgentHandoverFlow: Intento de "asesor" #${session.advisorAttempts}`);

            // Después de 2 intentos de "asesor", activar handover automáticamente
            if (session.advisorAttempts >= 2) {
                console.log('🚀 AgentHandoverFlow: Activando handover automático por múltiples intentos de "asesor"');
                return true;
            }
        }

        // Verificar keywords relacionadas con agente humano
        const agentKeywords = [
            'hablar con agente', 'hablar agente', 'agente humano', 'soporte humano',
            'persona real', 'operador', 'representante', 'asesor',
            'help', 'ayuda urgente', 'escalation', 'escalar', 'contactar agente'
        ];

        for (const keyword of agentKeywords) {
            if (messageLower.includes(keyword)) {
                console.log(`🎯 AgentHandoverFlow: Keyword detectado: "${keyword}"`);
                return true;
            }
        }

        return false;
    } async handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean> {
        // Solo procesar mensajes de texto
        if (typeof message !== 'string') return false;

        try {
            const messageLower = message.toLowerCase().trim();

            // Caso especial: múltiples intentos de "asesor"
            if (messageLower.includes('asesor') && session.advisorAttempts && session.advisorAttempts >= 2) {
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '🎯 **Entiendo que necesitas hablar con un asesor.**\n\n' +
                    '🚀 **Te estoy conectando inmediatamente con nuestro equipo humano.**\n\n' +
                    '⏳ **Por favor espera un momento...**'
                );

                // Limpiar contador después de manejar el caso
                session.advisorAttempts = 0;
            }

            // Verificar si el usuario está autenticado
            if (!user.authenticated) {
                // Para usuarios no autenticados, ofrecer opciones más amigables
                await this.handleUnauthenticatedAgentRequest(user, session);
                return true;
            }

            // Iniciar proceso de handover para usuarios autenticados
            await this.initiateAgentHandover(user, session);
            return true;

        } catch (error) {
            console.error('Error en AgentHandoverFlow:', error);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Ocurrió un error al intentar conectarte con un agente. Por favor intenta nuevamente.'
            );
            return true;
        }
    }    /**
     * Maneja usuarios no autenticados que quieren hablar con agente
     * Proporciona opciones más amigables sin forzar autenticación inmediata
     */
    private async handleUnauthenticatedAgentRequest(user: User, session: SessionData): Promise<void> {
        await this.messageService.sendTextMessage(
            user.phoneNumber,
            '� **¡Hola! Quieres hablar con un agente.**\n\n' +
            '� **Si ya eres cliente:**\n' +
            'Escribe tu número de cédula para autenticarte\n\n' +
            '🛒 **Si acabas de contratar o eres nuevo:**\n' +
            'Te conectaré con ventas para ayudarte\n\n' +
            '📞 **Llamada directa:**\n' +
            'Llama al **3242156679** (disponible 24/7)\n\n' +
            '¿Eres cliente existente? Escribe tu cédula.\n' +
            '¿Necesitas ventas/soporte general? Escribe "agente".'
        );        // Marcar que está esperando respuesta sobre tipo de usuario
        session.awaitingServiceSelection = true;
    }/**
     * Inicia el proceso de transferencia a agente humano
     */
    private async initiateAgentHandover(user: User, session: SessionData): Promise<void> {
        try {
            // Marcar sesión como en proceso de handover
            session.agentHandoverInProgress = true;
            session.handoverStartTime = new Date();
            session.botPaused = true; // PAUSAR EL BOT
            session.conversationWithAgent = true;

            // Obtener información del usuario para el agente
            const userInfo = await this.getUserContextForAgent(user);            // Crear conversación en el CRM MongoDB
            const conversationId = await this.createCRMConversation(user, userInfo, session);

            // Guardar el ID de conversación en la sesión
            session.crmConversationId = conversationId;

            // Enviar mensaje de confirmación al usuario
            await this.sendHandoverConfirmation(user, conversationId);

            // Notificar al CRM sobre la nueva conversación
            await this.notifyCRMSystem(user, userInfo, conversationId);

            // Limpiar estado de flujo activo después del handover
            session.flowActive = '';

            console.log(`✅ Handover completado - Bot PAUSADO - Conversación CRM: ${conversationId}`);

        } catch (error) {
            console.error('❌ Error en handover:', error);
            throw error;
        }
    }    /**
     * Crea una conversación en el CRM MongoDB
     */
    private async createCRMConversation(user: User, userInfo: object, session: SessionData): Promise<string> {
        try {
            // Obtener nombre del usuario
            let customerName = 'Cliente';
            if (user.encryptedData) {
                try {
                    const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                    customerName = decryptedData.customerName || 'Cliente';
                } catch (error) {
                    console.error('Error al decodificar datos del usuario:', error);
                }
            } console.log(`🔍 AgentHandoverFlow: Iniciando handover para ${user.phoneNumber}`);
            console.log(`📊 Estado de sesión actual:`, {
                flowActive: session.flowActive,
                conversationWithAgent: session.conversationWithAgent,
                botPaused: session.botPaused
            });

            // Verificar si ya hay una conversación activa para este usuario
            const existingConversations = await this.crmService.getConversations({
                phoneNumber: user.phoneNumber,
                status: 'active',
                limit: 5
            });

            console.log(`📋 Conversaciones existentes para ${user.phoneNumber}:`, existingConversations.conversations.length);

            // Crear conversación en MongoDB usando CRMServiceMongoDB
            const conversation = await this.crmService.createConversation(
                user.phoneNumber,
                customerName
            );

            console.log(`✅ Conversación CRM creada: ${conversation.id}`);

            // Crear mensaje inicial del handover
            await this.crmService.saveMessage({
                conversationId: conversation.id!,
                content: `👨‍💼 El usuario solicitó hablar con un agente humano`,
                messageType: 'system',
                fromNumber: user.phoneNumber,
                toNumber: 'system',
                isFromBot: true,
                isFromCustomer: false,
                aiProcessed: false,
                timestamp: new Date(),
                metadata: {
                    type: 'handover_request',
                    originalMessage: 'Hablar con Agente',
                    customerName: customerName,
                    phoneNumber: user.phoneNumber
                }
            });

            console.log(`✅ Mensaje inicial creado para conversación: ${conversation.id}`);

            return conversation.id!;

        } catch (error) {
            console.error('Error creando conversación CRM:', error);
            throw error;
        }
    }    /**
     * Notifica al CRM frontend sobre la nueva conversación
     */
    private async notifyCRMSystem(user: User, userInfo: object, conversationId: string): Promise<void> {
        try {
            console.log(`🔔 NOTIFICANDO AL CRM FRONTEND:`);
            console.log(`📱 Cliente: ${user.phoneNumber}`);
            console.log(`💬 Conversación ID: ${conversationId}`);
            console.log(`📋 Contexto:`, userInfo);

            // Preparar datos para el frontend
            const notificationData = {
                type: 'new_conversation',
                conversationId,
                phoneNumber: user.phoneNumber,
                customerInfo: userInfo,
                timestamp: new Date().toISOString(),
                priority: 'normal',
                source: 'whatsapp_handover',
                message: `Nueva conversación de ${user.phoneNumber}`
            };

            // Enviar notificación en tiempo real al frontend CRM via WebSocket
            try {
                const { WebSocketService } = await import('../services/WebSocketService');
                const wsService = WebSocketService.getInstance();
                wsService.broadcastToRoom('crm-agents', 'new_conversation', notificationData);
                console.log(`📡 Notificación WebSocket enviada a agentes CRM`);
            } catch (wsError) {
                console.error('Error enviando notificación WebSocket:', wsError);
            }

            // También registrar en logs para debugging
            console.log(`✅ Conversación disponible en CRM dashboard - ID: ${conversationId}`);

        } catch (error) {
            console.error('Error notificando al CRM:', error);
            // No relanzar el error para no fallar el handover
        }
    }/**
     * Recopila información del usuario para el agente
     */
    private async getUserContextForAgent(user: User): Promise<object> {
        // Obtener nombre del usuario desde encryptedData
        let customerName = 'No proporcionado';
        if (user.encryptedData) {
            try {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                customerName = decryptedData.customerName || 'No proporcionado';
            } catch (error) {
                console.error('Error al decodificar datos del usuario:', error);
            }
        }

        return {
            phoneNumber: user.phoneNumber,
            customerId: user.customerId || 'No identificado',
            customerName,
            isAuthenticated: user.authenticated,
            lastActivity: user.lastActivity || new Date(),
            sessionInfo: {
                hasActiveSession: !!user.sessionId,
                sessionStart: user.sessionId ? new Date() : null
            }
        };
    }/**
     * Crea ticket de seguimiento para el handover
     */
    private async createHandoverTicket(user: User, userInfo: object): Promise<string> {
        // Verificar si el usuario tiene servicio suspendido
        const isServiceSuspended = user.encryptedData &&
            JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData))?.isInactive;

        // Obtener nombre del usuario desde encryptedData
        let customerName = 'No proporcionado';
        if (user.encryptedData) {
            try {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                customerName = decryptedData.customerName || 'No proporcionado';
            } catch (error) {
                console.error('Error al decodificar datos del usuario:', error);
            }
        } const ticketCategory = isServiceSuspended ? 'reactivacion_servicio' : 'soporte_agente';
        const ticketPriority: 'alta' | 'media' | 'baja' = 'alta';

        const ticketData = {
            customerId: user.customerId || user.phoneNumber,
            category: ticketCategory,
            description: isServiceSuspended ?
                `**SOLICITUD DE REACTIVACIÓN DE SERVICIO**\n\n` +
                `**Cliente:** ${user.phoneNumber}\n` +
                `**Nombre:** ${customerName}\n` +
                `**Estado del servicio:** SUSPENDIDO\n` +
                `**Fecha solicitud:** ${new Date().toLocaleString('es-CO')}\n\n` +
                `**Información del contexto:**\n` +
                `${JSON.stringify(userInfo, null, 2)}\n\n` +
                `**ACCIÓN REQUERIDA:** Cliente con servicio suspendido solicita reactivación.` :
                `**SOLICITUD DE AGENTE HUMANO**\n\n` +
                `**Cliente:** ${user.phoneNumber}\n` +
                `**Nombre:** ${customerName}\n` +
                `**Autenticado:** ${user.authenticated ? 'Sí' : 'No'}\n` +
                `**Fecha solicitud:** ${new Date().toLocaleString('es-CO')}\n\n` +
                `**Información del contexto:**\n` +
                `${JSON.stringify(userInfo, null, 2)}\n\n` +
                `**ACCIÓN REQUERIDA:** Cliente solicita atención por agente humano.`,
            priority: ticketPriority,
            source: 'whatsapp',
            metadata: {
                handoverRequest: true,
                userContext: userInfo,
                requestTime: new Date(),
                botHandoverInitiated: true,
                serviceSuspended: isServiceSuspended
            }
        };

        return await this.ticketService.createTicket(ticketData);
    }    /**
     * Envía confirmación de handover al usuario
     */
    private async sendHandoverConfirmation(user: User, conversationId: string): Promise<void> {
        const currentTime = new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Verificar si el usuario tiene servicio suspendido
        const isServiceSuspended = user.encryptedData &&
            JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData))?.isInactive;

        let confirmationMessage: string;

        if (isServiceSuspended) {
            confirmationMessage =
                `👨‍💼 **CONECTANDO CON AGENTE - SERVICIO SUSPENDIDO**\n\n` +
                `⚠️ **Tu servicio requiere reactivación**\n` +
                `💬 **Conversación:** #${conversationId}\n` +
                `⏰ **Hora:** ${currentTime}\n\n` +
                `🔄 **¿Qué sigue?**\n` +
                `• Un agente especializado en reactivaciones te contactará\n` +
                `• Revisará tu cuenta y opciones de pago\n` +
                `• Te ayudará a reactivar tu servicio\n` +
                `• Tu conversación está ahora en nuestro sistema CRM\n\n` +
                `📞 **¿Es urgente?** Llama al **3242156679**\n\n` +
                `⏳ **Tiempo estimado de respuesta:** 5-10 minutos\n` +
                `(En horario laboral: Lun-Vie 8:00-18:00, Sáb 8:00-12:00)`;
        } else {
            confirmationMessage =
                `👨‍💼 **CONECTANDO CON AGENTE HUMANO**\n\n` +
                `✅ **Tu solicitud ha sido procesada**\n` +
                `💬 **Conversación:** #${conversationId}\n` +
                `⏰ **Hora:** ${currentTime}\n\n` +
                `🔄 **¿Qué sigue?**\n` +
                `• Un agente será notificado inmediatamente\n` +
                `• Te contactará a través del sistema CRM\n` +
                `• Tu conversación está registrada y disponible\n` +
                `• Mantén esta conversación abierta\n\n` +
                `📞 **¿Es urgente?** Llama al **3242156679**\n\n` +
                `⏳ **Tiempo estimado de respuesta:** 5-10 minutos\n` +
                `(En horario laboral: Lun-Vie 8:00-18:00, Sáb 8:00-12:00)`;
        }

        await this.messageService.sendTextMessage(user.phoneNumber, confirmationMessage);
    }

    /**
     * Notifica al sistema de agentes (preparado para CRM futuro)
     */
    private async notifyAgentSystem(user: User, userInfo: object, ticketId: string): Promise<void> {
        console.log(`🔔 NOTIFICACIÓN DE AGENTE REQUERIDA:`);
        console.log(`📱 Cliente: ${user.phoneNumber}`);
        console.log(`🎫 Ticket: ${ticketId}`);
        console.log(`📋 Contexto:`, userInfo);

        // TODO: Integrar con CRM cuando esté disponible
        // Este endpoint estará listo para conectar con el CRM
        /*
        try {
            await axios.post(process.env.CRM_AGENT_NOTIFICATION_URL, {
                ticketId,
                userPhone: user.phoneNumber,
                userContext: userInfo,
                priority: 'normal',
                requestTime: new Date().toISOString()
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.CRM_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Error notificando al CRM:', error);
        }
        */
    }    /**
     * Ejecuta el protocolo de handover de Meta para transferir conversación
     */
    private async executeMetaHandoverProtocol(user: User, ticketId: string): Promise<void> {
        try {
            // Obtener nombre del usuario desde encryptedData
            let customerName = '';
            if (user.encryptedData) {
                try {
                    const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                    customerName = decryptedData.customerName || '';
                } catch (error) {
                    console.error('Error al decodificar datos del usuario:', error);
                }
            }

            // Preparar metadata para el handover
            const handoverMetadata = {
                ticket_id: ticketId,
                user_phone: user.phoneNumber,
                customer_id: user.customerId || '',
                customer_name: customerName,
                handover_time: new Date().toISOString(),
                source: 'whatsapp_bot'
            };

            console.log(`🔄 INICIANDO META HANDOVER PROTOCOL:`);
            console.log(`📱 Usuario: ${user.phoneNumber}`);
            console.log(`🎫 Ticket: ${ticketId}`);
            console.log(`📋 Metadata:`, handoverMetadata);

            // TODO: Implementar cuando tengamos CRM configurado
            // Este es el endpoint que Meta usará para transferir la conversación
            /*
            const handoverResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${config.meta.phoneNumberId}/conversations`,
                {
                    recipient: {
                        phone_number: user.phoneNumber
                    },
                    action: 'pass_thread_control',
                    target_app_id: process.env.CRM_META_APP_ID,
                    metadata: JSON.stringify(handoverMetadata)
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.meta.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Handover ejecutado exitosamente:', handoverResponse.data);
            */

        } catch (error) {
            console.error('❌ Error ejecutando Meta Handover Protocol:', error);
            // No fallar el flujo, solo loggear el error
        }
    }

    /**
     * Procesa eventos de handover recibidos desde Meta API
     * @param handoverEvent Evento de handover recibido
     */
    public static async processHandoverEvent(
        handoverEvent: WhatsAppHandoverEvent,
        messageService: MessageService
    ): Promise<void> {
        try {
            const phoneNumber = handoverEvent.sender.phone_number;
            const timestamp = handoverEvent.timestamp;
            const metadata = handoverEvent.control_passed.metadata || '';

            console.log(`[HandoverEvent] Recibido evento de handover para ${phoneNumber}`);
            console.log(`[HandoverEvent] Timestamp: ${timestamp}`);
            console.log(`[HandoverEvent] Metadata: ${metadata}`);

            // Enviar notificación al usuario sobre la transferencia completada
            await messageService.sendTextMessage(
                phoneNumber,
                '✅ **Transferencia Completada**\n\n' +
                'Tu conversación ha sido transferida exitosamente a un agente humano.\n\n' +
                '👨‍💼 Un representante atenderá tu consulta lo antes posible.\n\n' +
                '⏱️ Tiempo estimado de respuesta: 5-10 minutos.'
            );

            // Si hay metadatos, procesarlos
            if (metadata) {
                try {
                    const parsedMetadata = JSON.parse(metadata);
                    console.log(`[HandoverEvent] Metadata parseado:`, parsedMetadata);

                    // Aquí se podría implementar lógica adicional basada en los metadatos
                    // Por ejemplo, notificar a sistemas internos, actualizar tickets, etc.
                } catch (error) {
                    console.error(`[HandoverEvent] Error al parsear metadata:`, error);
                }
            }

            // Aquí se podría implementar más lógica como:
            // - Actualizar tickets en sistemas CRM
            // - Notificar a otros sistemas
            // - Registrar métricas de handover

        } catch (error) {
            console.error(`[HandoverEvent] Error procesando evento de handover:`, error);
        }
    }
}

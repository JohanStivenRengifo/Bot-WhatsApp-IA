import { Request, Response } from 'express';
import { MessageService } from '../services/MessageService';
import { TicketService } from '../services/TicketService';
import { config } from '../config';

export interface CRMHandoverRequest {
    ticketId: string;
    userPhone: string;
    agentId: string;
    agentName: string;
    handoverType: 'bot_to_human' | 'human_to_bot';
    metadata?: object;
}

export interface CRMAgentMessage {
    ticketId: string;
    userPhone: string;
    agentId: string;
    message: string;
    messageType: 'text' | 'image' | 'document';
    timestamp: string;
}

/**
 * Controlador para manejar la integración con CRM y handovers de agentes
 */
export class CRMController {
    private messageService: MessageService;
    private ticketService: TicketService;

    constructor() {
        this.messageService = MessageService.getInstance();
        this.ticketService = new TicketService();
    }

    /**
     * Endpoint para recibir notificaciones de handover desde el CRM
     * POST /api/crm/handover
     */
    async handleHandover(req: Request, res: Response): Promise<void> {
        try {
            const handoverData: CRMHandoverRequest = req.body;

            // Validar datos requeridos
            if (!handoverData.ticketId || !handoverData.userPhone || !handoverData.agentId) {
                res.status(400).json({
                    error: 'Missing required fields: ticketId, userPhone, agentId'
                });
                return;
            }

            console.log(`🔄 HANDOVER RECIBIDO:`, handoverData);

            // Procesar según el tipo de handover
            if (handoverData.handoverType === 'bot_to_human') {
                await this.processBotToHumanHandover(handoverData);
            } else if (handoverData.handoverType === 'human_to_bot') {
                await this.processHumanToBotHandover(handoverData);
            }

            res.status(200).json({
                success: true,
                message: 'Handover processed successfully',
                ticketId: handoverData.ticketId
            });

        } catch (error) {
            console.error('Error processing handover:', error);
            res.status(500).json({
                error: 'Internal server error processing handover'
            });
        }
    }

    /**
     * Endpoint para que el CRM envíe mensajes al usuario a través del bot
     * POST /api/crm/send-message
     */
    async sendMessageFromAgent(req: Request, res: Response): Promise<void> {
        try {
            const messageData: CRMAgentMessage = req.body;

            // Validar datos requeridos
            if (!messageData.userPhone || !messageData.message || !messageData.agentId) {
                res.status(400).json({
                    error: 'Missing required fields: userPhone, message, agentId'
                });
                return;
            }

            console.log(`📨 MENSAJE DE AGENTE:`, {
                agent: messageData.agentId,
                phone: messageData.userPhone,
                ticket: messageData.ticketId
            });

            // Formatear mensaje con identificación del agente
            const formattedMessage = this.formatAgentMessage(messageData);

            // Enviar mensaje al usuario
            await this.messageService.sendTextMessage(
                messageData.userPhone,
                formattedMessage
            );

            // Actualizar ticket con la respuesta del agente
            if (messageData.ticketId) {
                await this.updateTicketWithAgentResponse(messageData);
            }

            res.status(200).json({
                success: true,
                message: 'Message sent successfully',
                ticketId: messageData.ticketId
            });

        } catch (error) {
            console.error('Error sending agent message:', error);
            res.status(500).json({
                error: 'Internal server error sending message'
            });
        }
    }

    /**
     * Endpoint para obtener el estado de un handover
     * GET /api/crm/handover-status/:ticketId
     */
    async getHandoverStatus(req: Request, res: Response): Promise<void> {
        try {
            const { ticketId } = req.params;

            if (!ticketId) {
                res.status(400).json({
                    error: 'Missing ticketId parameter'
                });
                return;
            }

            // TODO: Obtener estado real del ticket desde la base de datos
            const handoverStatus = {
                ticketId,
                status: 'active',
                assignedAgent: null,
                startTime: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                messageCount: 0
            };

            res.status(200).json(handoverStatus);

        } catch (error) {
            console.error('Error getting handover status:', error);
            res.status(500).json({
                error: 'Internal server error getting status'
            });
        }
    }

    /**
     * Endpoint para webhook de Meta cuando se transfiere control
     * POST /api/crm/meta-handover-webhook
     */
    async handleMetaHandoverWebhook(req: Request, res: Response): Promise<void> {
        try {
            console.log('📨 Meta Handover Webhook recibido:', req.body);

            const body = req.body;

            // Verificar que es un evento de handover
            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry || []) {
                    for (const change of entry.changes || []) {
                        if (change.field === 'messaging_handovers') {
                            await this.processMetaHandoverEvent(change.value);
                        }
                    }
                }
            }

            res.status(200).send('EVENT_RECEIVED');

        } catch (error) {
            console.error('Error processing Meta handover webhook:', error);
            res.status(500).json({
                error: 'Internal server error processing webhook'
            });
        }
    }

    /**
     * Procesa handover de bot a humano
     */
    private async processBotToHumanHandover(handoverData: CRMHandoverRequest): Promise<void> {
        // Notificar al usuario que un agente se ha conectado
        await this.messageService.sendTextMessage(
            handoverData.userPhone,
            `👨‍💼 **¡AGENTE CONECTADO!**\n\n` +
            `✅ **${handoverData.agentName}** se ha unido a la conversación\n` +
            `🎫 **Ticket:** #${handoverData.ticketId}\n\n` +
            `💬 **Ahora puedes escribir directamente y el agente te responderá**\n` +
            `⏰ **Tiempo de respuesta:** Inmediato\n\n` +
            `🔄 **Para volver al menú automático:** Escribe "menu"`
        );

        // Log del evento
        console.log(`✅ Bot-to-Human handover completed for ticket ${handoverData.ticketId}`);
    }

    /**
     * Procesa handover de humano a bot
     */
    private async processHumanToBotHandover(handoverData: CRMHandoverRequest): Promise<void> {
        // Notificar al usuario que el agente se ha desconectado
        await this.messageService.sendTextMessage(
            handoverData.userPhone,
            `🤖 **CONVERSACIÓN TRANSFERIDA AL BOT**\n\n` +
            `👋 **${handoverData.agentName}** ha finalizado la atención\n` +
            `🎫 **Ticket:** #${handoverData.ticketId}\n\n` +
            `✅ **Tu consulta ha sido resuelta**\n` +
            `📝 **¿Necesitas algo más?** Escribe "menu" para ver opciones\n\n` +
            `🌟 **¡Gracias por usar nuestro servicio!**`
        );

        // Enviar menú principal
        setTimeout(async () => {
            await this.messageService.sendMainMenu(handoverData.userPhone);
        }, 2000);

        // Log del evento
        console.log(`✅ Human-to-Bot handover completed for ticket ${handoverData.ticketId}`);
    }

    /**
     * Formatea mensaje del agente con identificación
     */
    private formatAgentMessage(messageData: CRMAgentMessage): string {
        const timestamp = new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `👨‍💼 **Agente ${messageData.agentId}** (${timestamp})\n\n${messageData.message}`;
    }

    /**
     * Actualiza ticket con respuesta del agente
     */
    private async updateTicketWithAgentResponse(messageData: CRMAgentMessage): Promise<void> {
        try {
            // TODO: Implementar actualización real del ticket
            console.log(`📝 Actualizando ticket ${messageData.ticketId} con respuesta del agente ${messageData.agentId}`);

            /*
            await this.ticketService.addComment(messageData.ticketId, {
                author: `Agent ${messageData.agentId}`,
                comment: messageData.message,
                timestamp: new Date(),
                type: 'agent_response'
            });
            */

        } catch (error) {
            console.error('Error updating ticket with agent response:', error);
        }
    }

    /**
     * Procesa eventos de handover de Meta
     */
    private async processMetaHandoverEvent(handoverValue: any): Promise<void> {
        console.log('🔄 Procesando evento de Meta Handover:', handoverValue);

        // TODO: Implementar lógica específica según el evento de Meta
        // Eventos posibles: pass_thread_control, take_thread_control, request_thread_control

        if (handoverValue.event === 'pass_thread_control') {
            console.log('✅ Control transferido exitosamente');
        } else if (handoverValue.event === 'take_thread_control') {
            console.log('✅ Control tomado exitosamente');
        }
    }
}

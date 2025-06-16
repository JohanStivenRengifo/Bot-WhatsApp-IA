import { Request, Response } from 'express';
import { CRMServiceMongoDB } from '../services/CRMServiceMongoDB';
import { MessageService } from '../services/MessageService';
import { ConversationFilter, MessageFilter } from '../interfaces/CRM';

/**
 * Controlador CRM actualizado para MongoDB
 */
export class CRMControllerMongoDB {
    private crmService: CRMServiceMongoDB;
    private messageService: MessageService;

    constructor() {
        this.crmService = CRMServiceMongoDB.getInstance();
        this.messageService = MessageService.getInstance();
    }

    /**
     * Autenticar usuario
     * POST /api/crm/auth/login
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email y contraseña son requeridos' });
                return;
            }

            const result = await this.crmService.authenticateUser(email, password); if (result.success) {
                res.json({
                    success: true,
                    data: {
                        token: result.token,
                        user: result.user
                    },
                    message: result.message
                });
            } else {
                res.status(401).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    /**
     * Obtener datos del dashboard
     * GET /api/crm/dashboard
     */
    async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const dashboardData = await this.crmService.getDashboardData();
            res.json(dashboardData);
        } catch (error) {
            console.error('Error obteniendo dashboard:', error);
            res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
        }
    }

    /**
     * Obtener conversaciones con filtros
     * GET /api/crm/conversations
     */
    async getConversations(req: Request, res: Response): Promise<void> {
        try {
            const filters: ConversationFilter = {
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20,
                status: req.query.status as any,
                assignedTo: req.query.assignedTo as string,
                phoneNumber: req.query.phoneNumber as string,
                priority: req.query.priority as any
            };

            if (req.query.startDate) {
                filters.startDate = new Date(req.query.startDate as string);
            }
            if (req.query.endDate) {
                filters.endDate = new Date(req.query.endDate as string);
            } const result = await this.crmService.getConversations(filters);

            // Formatear respuesta para el frontend
            res.json({
                data: result.conversations,
                pagination: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                    hasNext: result.page < result.totalPages,
                    hasPrev: result.page > 1
                }
            });

        } catch (error) {
            console.error('Error obteniendo conversaciones:', error);
            res.status(500).json({ error: 'Error obteniendo conversaciones' });
        }
    }

    /**
     * Obtener mensajes de una conversación
     * GET /api/crm/conversations/:id/messages
     */
    async getConversationMessages(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const filters: MessageFilter = {
                limit: parseInt(req.query.limit as string) || 100,
                messageType: req.query.messageType as any,
                fromBot: req.query.fromBot === 'true'
            };

            const messages = await this.crmService.getMessages(conversationId, filters);
            res.json(messages);

        } catch (error) {
            console.error('Error obteniendo mensajes:', error);
            res.status(500).json({ error: 'Error obteniendo mensajes' });
        }
    }

    /**
     * Asignar conversación a agente
     * POST /api/crm/conversations/:id/assign
     */
    async assignConversation(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const { agentId } = req.body;

            if (!agentId) {
                res.status(400).json({ error: 'agentId es requerido' });
                return;
            }

            await this.crmService.assignConversation(conversationId, agentId);
            res.json({ success: true, message: 'Conversación asignada exitosamente' });

        } catch (error) {
            console.error('Error asignando conversación:', error);
            res.status(500).json({ error: 'Error asignando conversación' });
        }
    }    /**
     * Enviar mensaje de agente
     * POST /api/crm/conversations/:id/send-message
     */
    async sendAgentMessage(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const { message, content, messageType = 'text', agentId } = req.body;

            // Usar message o content (para compatibilidad)
            const messageContent = message || content;

            if (!messageContent) {
                res.status(400).json({
                    success: false,
                    error: 'message es requerido'
                });
                return;
            }

            // Obtener conversación para obtener el número de teléfono
            const conversation = await this.crmService.getConversationById(conversationId);
            if (!conversation) {
                res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
                return;
            }

            // Enviar mensaje a través de WhatsApp
            const whatsappMessage = {
                messaging_product: "whatsapp",
                to: conversation.phoneNumber,
                type: "text",
                text: {
                    body: messageContent
                }
            };

            await this.messageService.sendMessage(whatsappMessage);

            // Guardar mensaje en la base de datos
            const messageData = {
                conversationId,
                fromNumber: process.env.PHONE_NUMBER_ID || '',
                toNumber: conversation.phoneNumber,
                content: messageContent,
                messageType,
                isFromBot: false,
                isFromCustomer: false,
                agentId: agentId || 'agent-1', // TODO: Obtener agentId del token
                timestamp: new Date()
            }; const savedMessage = await this.crmService.saveMessage(messageData);

            // Notificar via WebSocket sobre el nuevo mensaje
            try {
                const { WebSocketService } = await import('../services/WebSocketService');
                const wsService = WebSocketService.getInstance();
                wsService.notifyNewMessage(conversationId, {
                    id: savedMessage.id,
                    content: messageContent,
                    direction: 'outbound',
                    timestamp: savedMessage.timestamp,
                    agentId: agentId || 'agent-1'
                });

                // Notificar actividad del agente (para actualizar timeout)
                wsService.broadcastToRoom('bot-handlers', 'agent_activity', {
                    phoneNumber: conversation.phoneNumber,
                    conversationId,
                    timestamp: new Date().toISOString()
                });
            } catch (wsError) {
                console.error('Error enviando notificación WebSocket:', wsError);
            }

            res.json({
                success: true,
                message: 'Mensaje enviado exitosamente',
                data: savedMessage
            });

        } catch (error) {
            console.error('Error enviando mensaje:', error);
            res.status(500).json({
                success: false,
                error: 'Error enviando mensaje'
            });
        }
    }

    /**
     * Agregar nota a conversación
     * POST /api/crm/conversations/:id/notes
     */
    async addNote(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const { note, agentId } = req.body;

            if (!note || !agentId) {
                res.status(400).json({ error: 'note y agentId son requeridos' });
                return;
            }

            const savedNote = await this.crmService.addNoteToConversation(conversationId, note, agentId);
            res.json(savedNote);

        } catch (error) {
            console.error('Error agregando nota:', error);
            res.status(500).json({ error: 'Error agregando nota' });
        }
    }

    /**
     * Obtener notas de conversación
     * GET /api/crm/conversations/:id/notes
     */
    async getConversationNotes(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const notes = await this.crmService.getConversationNotes(conversationId);
            res.json(notes);

        } catch (error) {
            console.error('Error obteniendo notas:', error);
            res.status(500).json({ error: 'Error obteniendo notas' });
        }
    }

    /**
     * Obtener usuarios/agentes
     * GET /api/crm/users
     */
    async getUsers(req: Request, res: Response): Promise<void> {
        try {
            const filters = {
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 10,
                role: req.query.role as string,
                status: req.query.status as 'active' | 'inactive'
            };

            const result = await this.crmService.getUsers(filters);
            res.json(result);

        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({ error: 'Error obteniendo usuarios' });
        }
    }

    /**
     * Crear usuario
     * POST /api/crm/users
     */
    async createUser(req: Request, res: Response): Promise<void> {
        try {
            const userData = req.body;
            const newUser = await this.crmService.createUser(userData);
            res.status(201).json(newUser);

        } catch (error) {
            console.error('Error creando usuario:', error);
            res.status(500).json({ error: 'Error creando usuario' });
        }
    }

    /**
     * Obtener tags
     * GET /api/crm/tags
     */
    async getTags(req: Request, res: Response): Promise<void> {
        try {
            const tags = await this.crmService.getTags();
            res.json(tags);

        } catch (error) {
            console.error('Error obteniendo tags:', error);
            res.status(500).json({ error: 'Error obteniendo tags' });
        }
    }

    /**
     * Crear tag
     * POST /api/crm/tags
     */
    async createTag(req: Request, res: Response): Promise<void> {
        try {
            const tagData = req.body;
            const newTag = await this.crmService.createTag(tagData);
            res.status(201).json(newTag);

        } catch (error) {
            console.error('Error creando tag:', error);
            res.status(500).json({ error: 'Error creando tag' });
        }
    }

    /**
     * Webhook para manejar nuevos mensajes de WhatsApp
     * POST /api/crm/webhook/message
     */
    async handleIncomingMessage(req: Request, res: Response): Promise<void> {
        try {
            const { from, to, message, messageId, timestamp } = req.body;

            // Crear o buscar conversación
            const conversation = await this.crmService.createConversation(from);

            // Guardar mensaje
            const messageData = {
                conversationId: conversation.id,
                messageId,
                fromNumber: from,
                toNumber: to,
                content: message.text?.body || message.caption || '',
                messageType: message.type || 'text',
                mediaUrl: message.image?.link || message.document?.link || message.audio?.link,
                mediaCaption: message.caption,
                isFromBot: false,
                isFromCustomer: true,
                timestamp: new Date(parseInt(timestamp) * 1000)
            };

            const savedMessage = await this.crmService.saveMessage(messageData);
            res.json({ success: true, message: savedMessage });

        } catch (error) {
            console.error('Error procesando mensaje:', error);
            res.status(500).json({ error: 'Error procesando mensaje' });
        }
    }

    /**
     * Obtener usuario actual (verificar token)
     * GET /api/crm/auth/me
     */
    async getCurrentUser(req: Request & { user?: any }, res: Response): Promise<void> {
        try {
            // El usuario ya está disponible en req.user gracias al middleware authenticateToken
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Token inválido'
                });
                return;
            }

            // Obtener datos actualizados del usuario desde la base de datos
            const user = await this.crmService.getUserById(req.user.id);

            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: user
            });

        } catch (error) {
            console.error('Error obteniendo usuario actual:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * Obtener métricas en tiempo real
     * GET /api/crm/metrics/realtime
     */
    async getRealTimeMetrics(req: Request, res: Response): Promise<void> {
        try {
            const metrics = await this.crmService.getRealTimeMetrics();
            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('Error obteniendo métricas en tiempo real:', error);
            res.status(500).json({ error: 'Error obteniendo métricas' });
        }
    }

    /**
     * Obtener estadísticas de conversaciones
     * GET /api/crm/stats/conversations
     */
    async getConversationStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await this.crmService.getConversationStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas de conversaciones:', error);
            res.status(500).json({ error: 'Error obteniendo estadísticas' });
        }
    }

    /**
     * Obtener estadísticas de agentes
     * GET /api/crm/stats/agents
     */
    async getAgentStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await this.crmService.getAgentStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas de agentes:', error);
            res.status(500).json({ error: 'Error obteniendo estadísticas' });
        }
    }

    /**
     * Obtener estadísticas de mensajes
     * GET /api/crm/stats/messages
     */
    async getMessageStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await this.crmService.getMessageStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas de mensajes:', error);
            res.status(500).json({ error: 'Error obteniendo estadísticas' });
        }
    }    /**
     * Obtener lista de agentes
     * GET /api/crm/agents
     */
    async getAgents(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.crmService.getUsers({
                role: req.query.role as string,
                status: 'active',
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 50
            });
            res.json({
                success: true,
                data: result.users
            });
        } catch (error) {
            console.error('Error obteniendo agentes:', error);
            res.status(500).json({ error: 'Error obteniendo agentes' });
        }
    }

    /**
     * Obtener configuración del sistema
     * GET /api/crm/settings
     */
    async getSystemSettings(req: Request, res: Response): Promise<void> {
        try {
            const settings = await this.crmService.getSystemSettings();
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Error obteniendo configuración del sistema:', error);
            res.status(500).json({ error: 'Error obteniendo configuración' });
        }
    }

    /**
     * Actualizar configuración del sistema
     * POST /api/crm/settings
     */
    async updateSystemSettings(req: Request, res: Response): Promise<void> {
        try {
            const settings = req.body;
            const result = await this.crmService.updateSystemSettings(settings);

            if (result.success) {
                res.json({
                    success: true,
                    data: result.settings,
                    message: 'Configuración actualizada correctamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.message || 'Error actualizando configuración'
                });
            }
        } catch (error) {
            console.error('Error actualizando configuración del sistema:', error);
            res.status(500).json({ error: 'Error actualizando configuración' });
        }
    }    /**
     * Obtener una conversación específica por ID
     * GET /api/crm/conversations/:id
     */
    async getConversationById(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;

            // Obtener la conversación específica
            const conversation = await this.crmService.getConversationById(conversationId);

            if (!conversation) {
                res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
                return;
            }

            res.json({
                success: true,
                data: {
                    conversation: conversation
                }
            });

        } catch (error) {
            console.error('Error obteniendo conversación:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo conversación'
            });
        }
    }

    /**
     * Obtener mensajes de una conversación con información completa
     * GET /api/crm/conversations/:id/messages-full
     */
    async getConversationMessagesFull(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const filters: MessageFilter = {
                limit: parseInt(req.query.limit as string) || 100,
                messageType: req.query.messageType as any,
                fromBot: req.query.fromBot === 'true'
            };

            const messages = await this.crmService.getMessages(conversationId, filters);

            // Formatear mensajes para el frontend
            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                content: msg.content,
                timestamp: msg.timestamp,
                direction: msg.isFromCustomer ? 'inbound' : 'outbound',
                status: 'delivered', // TODO: Implementar estado real
                messageType: msg.messageType,
                fromNumber: msg.fromNumber,
                toNumber: msg.toNumber,
                isFromBot: msg.isFromBot,
                isFromCustomer: msg.isFromCustomer,
                agentId: msg.agentId,
                metadata: msg.metadata
            }));

            res.json({
                success: true,
                data: {
                    messages: formattedMessages,
                    total: messages.length
                }
            });

        } catch (error) {
            console.error('Error obteniendo mensajes completos:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo mensajes'
            });
        }
    }

    /**
     * Terminar conversación con agente y reactivar bot
     * POST /api/crm/conversations/:id/end-conversation
     */
    async endAgentConversation(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.id;
            const { reason = 'conversation_ended' } = req.body;

            // Obtener la conversación
            const conversation = await this.crmService.getConversationById(conversationId);
            if (!conversation) {
                res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
                return;
            }

            // Actualizar estado de la conversación
            await this.crmService.updateConversationStatus(conversationId, 'closed');

            // Notificar al bot para reactivarse (si hay algún sistema de notificación)
            await this.notifyBotReactivation(conversation.phoneNumber, reason);

            res.json({
                success: true,
                message: 'Conversación terminada y bot reactivado',
                conversationId
            });

        } catch (error) {
            console.error('Error terminando conversación con agente:', error);
            res.status(500).json({
                success: false,
                error: 'Error terminando conversación'
            });
        }
    }    /**
     * Notifica al bot para reactivarse después de terminar conversación con agente
     */
    private async notifyBotReactivation(phoneNumber: string, reason: string): Promise<void> {
        try {
            console.log(`🔄 Reactivando bot para ${phoneNumber} - Razón: ${reason}`);

            // Obtener la instancia del MessageHandler para reactivar el bot
            const MessageHandler = require('./MessageHandler').default;
            const messageHandlerInstance = MessageHandler.getInstance();

            if (messageHandlerInstance) {
                // Reactivar el bot directamente a través del MessageHandler
                await messageHandlerInstance.reactivateBotFromCRM(phoneNumber, reason);
                console.log(`✅ Bot reactivado exitosamente para ${phoneNumber}`);
            } else {
                console.warn(`⚠️ No se pudo obtener instancia del MessageHandler para ${phoneNumber}`);
            }

        } catch (error) {
            console.error('Error notificando reactivación del bot:', error);
        }
    }
}

export default CRMControllerMongoDB;

import { MongoDBService } from './MongoDBService';
import { MetricsService } from './MetricsService';
import { NotificationService } from './NotificationService';
import {
    CRMUser,
    Conversation,
    Message,
    Ticket,
    ConversationNote,
    Tag,
    AgentMetrics,
    CRMDashboardData,
    ConversationFilter,
    MessageFilter,
    BotControlCommand,
    HandoverRequest
} from '../interfaces/CRM';
import { EventEmitter } from 'events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ObjectId } from 'mongodb';

/**
 * Servicio principal del CRM para gestión de conversaciones humano-bot
 * Migrado a MongoDB
 */
export class CRMServiceMongoDB extends EventEmitter {
    private static instance: CRMServiceMongoDB;
    private db: MongoDBService;
    private metricsService: MetricsService;
    private notificationService: NotificationService;

    private constructor() {
        super();
        this.db = MongoDBService.getInstance();
        this.metricsService = MetricsService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.initializeService();
    }

    static getInstance(): CRMServiceMongoDB {
        if (!CRMServiceMongoDB.instance) {
            CRMServiceMongoDB.instance = new CRMServiceMongoDB();
        }
        return CRMServiceMongoDB.instance;
    }

    private async initializeService(): Promise<void> {
        try {
            // Conectar a MongoDB
            await this.db.connect();

            // Inicializar datos por defecto
            await this.initializeDefaultTags();
            await this.initializeDefaultUsers();

            console.log('✅ CRMServiceMongoDB inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando CRMServiceMongoDB:', error);
        }
    }

    /**
     * Autenticar usuario del CRM
     */
    async authenticateUser(email: string, password: string): Promise<{
        success: boolean;
        user?: CRMUser;
        token?: string;
        message: string;
    }> {
        try {
            const user = await this.db.findOne('crmUsers', {
                email: email,
                isActive: true
            });

            if (!user) {
                return { success: false, message: 'Usuario no encontrado o inactivo' };
            }

            // Verificar contraseña (temporal para desarrollo)
            const isValid = password === 'admin123';

            if (!isValid) {
                return { success: false, message: 'Contraseña incorrecta' };
            }

            // Actualizar último login
            await this.db.updateOne('crmUsers',
                { _id: user._id },
                { lastLogin: new Date() }
            );

            // Generar token JWT
            const token = jwt.sign(
                { id: user._id.toString(), email: user.email, role: user.role },
                config.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const crmUser: CRMUser = MongoDBService.objectIdToString({
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                lastLogin: new Date(),
                profile: user.profile || {},
                permissions: user.permissions || [],
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            });

            return {
                success: true,
                user: crmUser,
                token,
                message: 'Login exitoso'
            };

        } catch (error) {
            console.error('Error en autenticación:', error);
            return { success: false, message: 'Error interno' };
        }
    }

    /**
     * Crear usuario
     */
    async createUser(userData: Partial<CRMUser>): Promise<CRMUser> {
        try {
            const newUser = {
                username: userData.username,
                email: userData.email,
                role: userData.role || 'agent',
                isActive: userData.isActive !== false,
                profile: userData.profile || {},
                permissions: userData.permissions || [],
                passwordHash: await bcrypt.hash('admin123', 10) // Temporal
            };

            const result = await this.db.insertOne('crmUsers', newUser);
            return MongoDBService.objectIdToString(result);

        } catch (error) {
            console.error('Error creando usuario:', error);
            throw error;
        }
    }

    /**
     * Obtener usuarios con filtros
     */
    async getUsers(filters: {
        page?: number;
        limit?: number;
        role?: string;
        status?: 'active' | 'inactive';
    }): Promise<{
        users: CRMUser[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            const page = filters.page || 1;
            const limit = filters.limit || 10;
            const skip = (page - 1) * limit;

            const query: any = {};
            if (filters.role) query.role = filters.role;
            if (filters.status) query.isActive = filters.status === 'active';

            const users = await this.db.find('crmUsers', query, {
                skip,
                limit,
                sort: { createdAt: -1 }
            });

            const total = await this.db.countDocuments('crmUsers', query);
            const totalPages = Math.ceil(total / limit);

            return {
                users: users.map(user => MongoDBService.objectIdToString(user)),
                total,
                page,
                totalPages
            };

        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            throw error;
        }
    }

    /**
     * Crear conversación
     */
    async createConversation(phoneNumber: string, customerName?: string): Promise<Conversation> {
        try {
            // Verificar si ya existe una conversación activa
            const existingConversation = await this.db.findOne('conversations', {
                phoneNumber,
                status: { $in: ['active', 'pending'] }
            });

            if (existingConversation) {
                return MongoDBService.objectIdToString(existingConversation);
            } const now = new Date();
            const newConversation = {
                phoneNumber,
                customerName: customerName || 'Cliente',
                status: 'active',
                assignedAgentId: null,
                lastMessageAt: now,
                createdAt: now,
                updatedAt: now,
                metadata: {
                    platform: 'whatsapp',
                    source: 'agent_handover',
                    priority: 'normal'
                },
                messageCount: 0,
                tags: []
            };

            const result = await this.db.insertOne('conversations', newConversation);
            const conversation = MongoDBService.objectIdToString(result);

            // Emitir evento
            this.emit('conversationCreated', conversation);

            return conversation;

        } catch (error) {
            console.error('Error creando conversación:', error);
            throw error;
        }
    }

    /**
     * Obtener conversaciones con filtros
     */
    async getConversations(filters: ConversationFilter): Promise<{
        conversations: Conversation[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const skip = (page - 1) * limit;

            const query: any = {};
            if (filters.status) query.status = filters.status; if (filters.assignedTo) query.assignedAgentId = filters.assignedTo;
            if (filters.phoneNumber) query.phoneNumber = { $regex: filters.phoneNumber, $options: 'i' };
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
                if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
            } const conversations = await this.db.find('conversations', query, {
                skip,
                limit,
                sort: { lastMessageAt: -1 }
            });

            const total = await this.db.countDocuments('conversations', query);
            const totalPages = Math.ceil(total / limit);

            // Enriquecer conversaciones con información adicional
            const enrichedConversations = await Promise.all(
                conversations.map(async (conv) => {
                    const enrichedConv = MongoDBService.objectIdToString(conv);

                    // Obtener nombre del agente asignado
                    if (enrichedConv.assignedAgentId) {
                        const agent = await this.db.findOne('crmUsers', {
                            _id: MongoDBService.stringToObjectId(enrichedConv.assignedAgentId)
                        });
                        enrichedConv.assignedAgentName = agent?.username || agent?.email || 'Agente';
                    }

                    // Contar mensajes de la conversación
                    enrichedConv.messageCount = await this.db.countDocuments('messages', {
                        conversationId: enrichedConv.id
                    });

                    // Contar mensajes no leídos (TODO: implementar lógica de lectura)
                    enrichedConv.unreadCount = 0;

                    return enrichedConv;
                })
            );

            return {
                conversations: enrichedConversations,
                total,
                page,
                totalPages
            };

        } catch (error) {
            console.error('Error obteniendo conversaciones:', error);
            throw error;
        }
    }

    /**
     * Asignar conversación a agente
     */
    async assignConversation(conversationId: string, agentId: string): Promise<void> {
        try {
            await this.db.updateOne('conversations',
                { _id: MongoDBService.stringToObjectId(conversationId) },
                {
                    assignedAgentId: agentId,
                    status: 'active'
                }
            );

            // Emitir evento
            this.emit('conversationAssigned', { conversationId, agentId });

        } catch (error) {
            console.error('Error asignando conversación:', error);
            throw error;
        }
    }

    /**
     * Guardar mensaje
     */
    async saveMessage(messageData: Partial<Message>): Promise<Message> {
        try {
            const newMessage = {
                conversationId: messageData.conversationId,
                messageId: messageData.messageId,
                fromNumber: messageData.fromNumber,
                toNumber: messageData.toNumber,
                messageType: messageData.messageType || 'text',
                content: messageData.content,
                mediaUrl: messageData.mediaUrl,
                mediaCaption: messageData.mediaCaption,
                isFromBot: messageData.isFromBot || false,
                isFromCustomer: messageData.isFromCustomer || true,
                timestamp: messageData.timestamp || new Date(),
                metadata: messageData.metadata || {}
            };

            const result = await this.db.insertOne('messages', newMessage);            // Actualizar última actividad de la conversación
            await this.db.updateOne('conversations',
                { _id: MongoDBService.stringToObjectId(messageData.conversationId!.toString()) },
                { lastMessageAt: new Date() }
            );

            const message = MongoDBService.objectIdToString(result);

            // Emitir evento
            this.emit('messageReceived', message);

            return message;

        } catch (error) {
            console.error('Error guardando mensaje:', error);
            throw error;
        }
    }

    /**
     * Obtener mensajes de una conversación
     */
    async getMessages(conversationId: string, filters: MessageFilter = {}): Promise<Message[]> {
        try {
            const query: any = { conversationId };
            if (filters.messageType) query.messageType = filters.messageType;
            if (filters.fromBot !== undefined) query.isFromBot = filters.fromBot;

            const messages = await this.db.find('messages', query, {
                sort: { timestamp: 1 },
                limit: filters.limit || 100
            });

            return messages.map(msg => MongoDBService.objectIdToString(msg));

        } catch (error) {
            console.error('Error obteniendo mensajes:', error);
            throw error;
        }
    }

    /**
     * Obtener dashboard data
     */
    async getDashboardData(): Promise<CRMDashboardData> {
        try {
            // Obtener estadísticas básicas
            const totalConversations = await this.db.countDocuments('conversations');
            const activeConversations = await this.db.countDocuments('conversations', { status: 'active' });
            const pendingConversations = await this.db.countDocuments('conversations', { status: 'pending' });
            const totalMessages = await this.db.countDocuments('messages');
            const totalAgents = await this.db.countDocuments('crmUsers', { role: 'agent', isActive: true });

            // Conversaciones recientes
            const recentConversations = await this.db.find('conversations', {}, {
                sort: { lastMessageAt: -1 },
                limit: 10
            });

            // Métricas por agente
            const agentsMetrics = await this.db.aggregate('conversations', [
                {
                    $match: {
                        assignedAgentId: { $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$assignedAgentId',
                        conversations: { $sum: 1 },
                        lastActivity: { $max: '$lastMessageAt' }
                    }
                }
            ]);

            return {
                stats: {
                    totalConversations,
                    activeConversations,
                    pendingConversations,
                    totalMessages,
                    totalAgents,
                    responseTimeAvg: 0, // TODO: Calcular tiempo de respuesta promedio
                    resolutionRate: 0 // TODO: Calcular tasa de resolución
                },
                recentConversations: recentConversations.map(conv => MongoDBService.objectIdToString(conv)),
                agentsPerformance: agentsMetrics.map(metric => MongoDBService.objectIdToString(metric)), messagesByHour: [], // TODO: Implementar estadísticas por hora
                conversationsByStatus: {
                    'active': activeConversations,
                    'pending': pendingConversations,
                    'closed': totalConversations - activeConversations - pendingConversations
                }
            };

        } catch (error) {
            console.error('Error obteniendo dashboard data:', error);
            throw error;
        }
    }

    /**
     * Inicializar tags por defecto
     */
    private async initializeDefaultTags(): Promise<void> {
        try {
            const defaultTags = [
                { name: 'Urgente', color: '#ff4444' },
                { name: 'Soporte Técnico', color: '#4444ff' },
                { name: 'Ventas', color: '#44ff44' },
                { name: 'Facturación', color: '#ffaa00' },
                { name: 'Reclamo', color: '#ff8800' }
            ];

            for (const tag of defaultTags) {
                const existing = await this.db.findOne('tags', { name: tag.name });
                if (!existing) {
                    await this.db.insertOne('tags', tag);
                }
            }

        } catch (error) {
            console.error('Error inicializando tags:', error);
        }
    }

    /**
     * Inicializar usuarios por defecto
     */
    private async initializeDefaultUsers(): Promise<void> {
        try {
            const adminUser = await this.db.findOne('crmUsers', { email: 'admin@conectabot.com' });

            if (!adminUser) {
                await this.db.insertOne('crmUsers', {
                    username: 'admin',
                    email: 'admin@conectabot.com',
                    role: 'admin',
                    isActive: true,
                    profile: { firstName: 'Admin', lastName: 'ConectaBot' },
                    permissions: ['*'],
                    passwordHash: await bcrypt.hash('admin123', 10)
                });
            }

        } catch (error) {
            console.error('Error inicializando usuarios:', error);
        }
    }

    // Métodos adicionales simplificados para inicio
    async getTags(): Promise<Tag[]> {
        const tags = await this.db.find('tags', {}, { sort: { name: 1 } });
        return tags.map(tag => MongoDBService.objectIdToString(tag));
    }

    async createTag(tagData: Partial<Tag>): Promise<Tag> {
        const result = await this.db.insertOne('tags', tagData);
        return MongoDBService.objectIdToString(result);
    }

    async addNoteToConversation(conversationId: string, note: string, agentId: string): Promise<ConversationNote> {
        const noteData = {
            conversationId,
            agentId,
            note,
            isPrivate: false
        };
        const result = await this.db.insertOne('conversationNotes', noteData);
        return MongoDBService.objectIdToString(result);
    }

    async getConversationNotes(conversationId: string): Promise<ConversationNote[]> {
        const notes = await this.db.find('conversationNotes',
            { conversationId },
            { sort: { createdAt: -1 } }
        );
        return notes.map(note => MongoDBService.objectIdToString(note));
    }

    /**
     * Obtener usuario por ID
     */
    async getUserById(userId: string): Promise<CRMUser | null> {
        try {
            const user = await this.db.findOne('crmUsers', {
                _id: new ObjectId(userId),
                isActive: true
            });

            if (!user) {
                return null;
            }

            const crmUser: CRMUser = MongoDBService.objectIdToString({
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                lastLogin: user.lastLogin,
                profile: user.profile || {},
                permissions: user.permissions || [],
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            });

            return crmUser;

        } catch (error) {
            console.error('❌ Error obteniendo usuario por ID:', error);
            return null;
        }
    }    /**
     * Obtener métricas en tiempo real
     */
    async getRealTimeMetrics() {
        try {
            const totalConversations = await this.db.countDocuments('conversations', {});
            const activeConversations = await this.db.countDocuments('conversations', { status: 'active' });
            const pendingConversations = await this.db.countDocuments('conversations', { status: 'pending' });
            const totalUsers = await this.db.countDocuments('crmUsers', { isActive: true });

            // Métricas básicas
            return {
                totalConversations,
                activeConversations,
                pendingConversations,
                totalUsers,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('❌ Error obteniendo métricas en tiempo real:', error);
            return {
                totalConversations: 0,
                activeConversations: 0,
                pendingConversations: 0,
                totalUsers: 0,
                timestamp: new Date()
            };
        }
    }

    /**
     * Obtener estadísticas de conversaciones
     */
    async getConversationStats() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const totalToday = await this.db.countDocuments('conversations', {
                createdAt: { $gte: startOfDay }
            });

            const byStatus = await this.db.aggregate('conversations', [
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            return {
                totalToday,
                byStatus: byStatus || []
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de conversaciones:', error);
            return {
                totalToday: 0,
                byStatus: []
            };
        }
    }

    /**
     * Obtener estadísticas de agentes
     */
    async getAgentStats() {
        try {
            const agents = await this.db.find('crmUsers', {
                isActive: true,
                role: { $in: ['agent', 'supervisor'] }
            });

            const stats = await Promise.all(agents.map(async (agent) => {
                const assignedConversations = await this.db.countDocuments('conversations', {
                    assignedTo: agent._id.toString()
                });

                return {
                    id: agent._id.toString(),
                    name: agent.profile?.firstName || agent.username,
                    email: agent.email,
                    role: agent.role,
                    assignedConversations,
                    lastLogin: agent.lastLogin
                };
            }));

            return stats;
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de agentes:', error);
            return [];
        }
    }

    /**
     * Obtener estadísticas de mensajes
     */
    async getMessageStats() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const totalToday = await this.db.countDocuments('messages', {
                timestamp: { $gte: startOfDay }
            });

            const byType = await this.db.aggregate('messages', [
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                }
            ]);

            return {
                totalToday,
                byType: byType || []
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de mensajes:', error);
            return {
                totalToday: 0,
                byType: []
            };
        }
    }

    /**
     * Obtener configuración del sistema
     */
    async getSystemSettings() {
        try {
            let settings = await this.db.findOne('systemSettings', { type: 'main' });

            if (!settings) {
                // Crear configuración por defecto si no existe
                const defaultSettings = {
                    type: 'main',
                    whatsappToken: process.env.WHATSAPP_TOKEN || '',
                    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
                    webhookUrl: process.env.WEBHOOK_URL || '',
                    enableNotifications: true,
                    notificationSound: true,
                    emailNotifications: false,
                    autoAssignConversations: true,
                    maxConversationsPerAgent: 10,
                    responseTimeAlert: 5,
                    apiUrl: process.env.API_URL || 'http://localhost:3000',
                    wsUrl: process.env.WS_URL || 'http://localhost:3000',
                };

                settings = await this.db.insertOne('systemSettings', defaultSettings);
            }

            return MongoDBService.objectIdToString(settings);
        } catch (error) {
            console.error('❌ Error obteniendo configuración del sistema:', error);
            throw error;
        }
    }

    /**
     * Actualizar configuración del sistema
     */
    async updateSystemSettings(newSettings: any): Promise<{
        success: boolean;
        settings?: any;
        message?: string;
    }> {
        try {
            const existingSettings = await this.db.findOne('systemSettings', { type: 'main' });

            if (existingSettings) {
                // Actualizar configuración existente
                const result = await this.db.updateOne(
                    'systemSettings',
                    { type: 'main' },
                    { ...newSettings, type: 'main' }
                );

                if (result.modifiedCount > 0) {
                    const updatedSettings = await this.db.findOne('systemSettings', { type: 'main' });
                    return {
                        success: true,
                        settings: MongoDBService.objectIdToString(updatedSettings),
                        message: 'Configuración actualizada correctamente'
                    };
                }
            } else {
                // Crear nueva configuración
                const settings = await this.db.insertOne('systemSettings', {
                    ...newSettings,
                    type: 'main'
                });
                return {
                    success: true,
                    settings: MongoDBService.objectIdToString(settings),
                    message: 'Configuración creada correctamente'
                };
            }

            return {
                success: false,
                message: 'No se pudo actualizar la configuración'
            };
        } catch (error) {
            console.error('❌ Error actualizando configuración del sistema:', error);
            return {
                success: false,
                message: 'Error interno del servidor'
            };
        }
    }

    /**
     * Obtener conversación por ID
     */
    async getConversationById(conversationId: string): Promise<Conversation | null> {
        try {
            const conversation = await this.db.findOne('conversations', {
                _id: MongoDBService.stringToObjectId(conversationId)
            });

            if (!conversation) {
                return null;
            }

            return MongoDBService.objectIdToString(conversation);

        } catch (error) {
            console.error('Error obteniendo conversación por ID:', error);
            throw error;
        }
    }

    /**
     * Actualizar estado de conversación
     */
    async updateConversationStatus(conversationId: string, status: string): Promise<void> {
        try {
            await this.db.updateOne('conversations',
                { _id: MongoDBService.stringToObjectId(conversationId) },
                {
                    status,
                    updatedAt: new Date(),
                    ...(status === 'closed' ? { closedAt: new Date() } : {})
                }
            );

            // Emitir evento
            this.emit('conversationStatusUpdated', { conversationId, status });

        } catch (error) {
            console.error('Error actualizando estado de conversación:', error);
            throw error;
        }
    }
}

export default CRMServiceMongoDB;

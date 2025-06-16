import { MongoDBService } from './MongoDBService';
import { ConversationTag, AgentSession, AgentAutoAssignment, CRMUser, Conversation } from '../interfaces/CRM';
import { EventEmitter } from 'events';

/**
 * Servicio para gestión avanzada de etiquetas y asignación automática de agentes
 */
export class ConversationEnhancementService extends EventEmitter {
    private static instance: ConversationEnhancementService;
    private db: MongoDBService;
    private activeSessions: Map<string, AgentSession> = new Map();
    private autoAssignmentConfig: AgentAutoAssignment;

    private constructor() {
        super();
        this.db = MongoDBService.getInstance();
        this.autoAssignmentConfig = {
            enabled: true,
            rules: {
                byWorkload: true,
                bySkills: false,
                byAvailability: true,
                roundRobin: true,
            },
            maxConversationsPerAgent: 5,
        };
        this.initializeService();
    }

    static getInstance(): ConversationEnhancementService {
        if (!ConversationEnhancementService.instance) {
            ConversationEnhancementService.instance = new ConversationEnhancementService();
        }
        return ConversationEnhancementService.instance;
    }

    private async initializeService(): Promise<void> {
        try {
            await this.db.connect();
            await this.initializeDefaultTags();
            await this.loadActiveSessions();
            console.log('✅ ConversationEnhancementService inicializado');
        } catch (error) {
            console.error('❌ Error inicializando ConversationEnhancementService:', error);
        }
    }

    /**
     * Gestión de Etiquetas
     */
    async initializeDefaultTags(): Promise<void> {
        const defaultTags: ConversationTag[] = [
            {
                id: 'urgent',
                name: 'Urgente',
                color: '#f44336',
                icon: '🚨',
                category: 'priority',
                isSystem: true,
                createdAt: new Date(),
            },
            {
                id: 'technical',
                name: 'Técnico',
                color: '#2196f3',
                icon: '🔧',
                category: 'type',
                isSystem: true,
                createdAt: new Date(),
            },
            {
                id: 'billing',
                name: 'Facturación',
                color: '#ff9800',
                icon: '💰',
                category: 'type',
                isSystem: true,
                createdAt: new Date(),
            },
            {
                id: 'commercial',
                name: 'Comercial',
                color: '#4caf50',
                icon: '💼',
                category: 'type',
                isSystem: true,
                createdAt: new Date(),
            },
            {
                id: 'support',
                name: 'Soporte',
                color: '#9c27b0',
                icon: '🎧',
                category: 'type',
                isSystem: true,
                createdAt: new Date(),
            },
            {
                id: 'vip',
                name: 'VIP',
                color: '#ffc107',
                icon: '⭐',
                category: 'status',
                isSystem: true,
                createdAt: new Date(),
            },
        ];

        for (const tag of defaultTags) {
            const exists = await this.db.findOne('conversationTags', { id: tag.id });
            if (!exists) {
                await this.db.insertOne('conversationTags', tag);
            }
        }
    }

    async createTag(tag: Omit<ConversationTag, 'id' | 'createdAt'>, userId: string): Promise<ConversationTag> {
        const newTag: ConversationTag = {
            ...tag,
            id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            createdBy: userId,
        };

        await this.db.insertOne('conversationTags', newTag);

        this.emit('tagCreated', newTag);
        return newTag;
    }

    async updateTag(tagId: string, updates: Partial<ConversationTag>): Promise<ConversationTag | null> {
        const result = await this.db.updateOne(
            'conversationTags',
            { id: tagId },
            { $set: { ...updates, updatedAt: new Date() } }
        );

        if (result.modifiedCount > 0) {
            const updatedTag = await this.db.findOne('conversationTags', { id: tagId });
            this.emit('tagUpdated', updatedTag);
            return updatedTag;
        }

        return null;
    }

    async deleteTag(tagId: string): Promise<boolean> {
        // No permitir eliminar etiquetas del sistema
        const tag = await this.db.findOne('conversationTags', { id: tagId });
        if (tag?.isSystem) {
            throw new Error('No se pueden eliminar etiquetas del sistema');
        }

        const result = await this.db.deleteOne('conversationTags', { id: tagId });

        if (result.deletedCount > 0) {
            // Remover la etiqueta de todas las conversaciones
            await this.db.updateMany(
                'conversations',
                { 'tags.id': tagId },
                { $pull: { tags: { id: tagId } } }
            );

            this.emit('tagDeleted', tagId);
            return true;
        }

        return false;
    }

    async getAllTags(): Promise<ConversationTag[]> {
        return await this.db.find('conversationTags', {});
    }

    async getTagsByCategory(category: string): Promise<ConversationTag[]> {
        return await this.db.find('conversationTags', { category });
    }

    async addTagsToConversation(conversationId: string, tagIds: string[]): Promise<boolean> {
        const tags = await this.db.find('conversationTags', { id: { $in: tagIds } });

        const result = await this.db.updateOne(
            'conversations',
            { id: conversationId },
            {
                $addToSet: { tags: { $each: tags } },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.modifiedCount > 0) {
            // Actualizar prioridad automáticamente basada en las etiquetas
            await this.updateConversationPriorityFromTags(conversationId, tags);

            this.emit('conversationTagsUpdated', { conversationId, tags });
            return true;
        }

        return false;
    }

    async removeTagsFromConversation(conversationId: string, tagIds: string[]): Promise<boolean> {
        const result = await this.db.updateOne(
            'conversations',
            { id: conversationId },
            {
                $pull: { tags: { id: { $in: tagIds } } },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.modifiedCount > 0) {
            // Recalcular prioridad después de quitar etiquetas
            const conversation = await this.db.findOne('conversations', { id: conversationId });
            if (conversation && conversation.tags) {
                await this.updateConversationPriorityFromTags(conversationId, conversation.tags);
            }

            this.emit('conversationTagsUpdated', { conversationId, removedTagIds: tagIds });
            return true;
        }

        return false;
    }

    /**
     * Actualiza la prioridad de una conversación basada en sus etiquetas
     */
    private async updateConversationPriorityFromTags(conversationId: string, tags: ConversationTag[]): Promise<void> {
        // Definir mapeo de prioridades por etiqueta
        const priorityMap: { [key: string]: number } = {
            'urgente': 5,
            'critico': 5,
            'alto': 4,
            'vip': 4,
            'reclamo': 4,
            'complaint': 4,
            'importante': 3,
            'seguimiento': 3,
            'follow-up': 3,
            'consulta': 2,
            'query': 2,
            'general': 1,
            'normal': 1
        };

        // Calcular la prioridad más alta basada en las etiquetas
        let highestPriority = 1; // Prioridad por defecto
        let priorityReason = 'normal';

        for (const tag of tags) {
            const tagName = tag.name.toLowerCase();
            const tagCategory = tag.category?.toLowerCase();

            // Buscar por nombre de etiqueta
            if (priorityMap[tagName] && priorityMap[tagName] > highestPriority) {
                highestPriority = priorityMap[tagName];
                priorityReason = tag.name;
            }

            // Buscar por categoría si es de prioridad
            if (tagCategory === 'priority' && priorityMap[tagName]) {
                highestPriority = Math.max(highestPriority, priorityMap[tagName]);
                priorityReason = tag.name;
            }
        }

        // Actualizar la conversación con la nueva prioridad
        await this.db.updateOne(
            'conversations',
            { id: conversationId },
            {
                $set: {
                    priority: highestPriority,
                    priorityReason: priorityReason,
                    priorityUpdatedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        console.log(`💡 Prioridad actualizada automáticamente para conversación ${conversationId}: ${highestPriority} (${priorityReason})`);

        // Emitir evento para notificar el cambio de prioridad
        this.emit('conversationPriorityUpdated', {
            conversationId,
            priority: highestPriority,
            reason: priorityReason
        });
    }

    /**
     * Gestión de Sesiones de Agentes
     */
    async loadActiveSessions(): Promise<void> {
        const sessions = await this.db.find('agentSessions', { isActive: true });
        for (const session of sessions) {
            this.activeSessions.set(session.agentId, session);
        }
    }

    async startAgentSession(agentId: string, sessionId: string, maxConversations: number = 5): Promise<AgentSession> {
        const existingSession = this.activeSessions.get(agentId);
        if (existingSession) {
            await this.endAgentSession(agentId);
        }

        const session: AgentSession = {
            id: `session_${Date.now()}_${agentId}`,
            agentId,
            sessionId,
            isActive: true,
            status: 'available',
            maxConversations,
            currentConversations: 0,
            startTime: new Date(),
            lastActivity: new Date(),
        };

        await this.db.insertOne('agentSessions', session);
        this.activeSessions.set(agentId, session);

        this.emit('agentSessionStarted', session);
        return session;
    }

    async updateAgentStatus(agentId: string, status: 'available' | 'busy' | 'away' | 'offline'): Promise<boolean> {
        const session = this.activeSessions.get(agentId);
        if (!session) return false;

        session.status = status;
        session.lastActivity = new Date();

        const result = await this.db.updateOne(
            'agentSessions',
            { agentId, isActive: true },
            {
                $set: {
                    status,
                    lastActivity: new Date()
                }
            }
        );

        if (result.modifiedCount > 0) {
            this.emit('agentStatusUpdated', { agentId, status });
            return true;
        }

        return false;
    }

    async endAgentSession(agentId: string): Promise<boolean> {
        const session = this.activeSessions.get(agentId);
        if (!session) return false;

        session.isActive = false;
        session.endTime = new Date();
        session.status = 'offline';

        const result = await this.db.updateOne(
            'agentSessions',
            { agentId, isActive: true },
            {
                $set: {
                    isActive: false,
                    endTime: new Date(),
                    status: 'offline'
                }
            }
        );

        this.activeSessions.delete(agentId);

        if (result.modifiedCount > 0) {
            this.emit('agentSessionEnded', { agentId });
            return true;
        }

        return false;
    }

    /**
     * Asignación Automática de Agentes
     */
    async assignAgentToConversation(conversationId: string, agentId?: string): Promise<string | null> {
        if (agentId) {
            // Asignación manual
            return await this.manualAssignAgent(conversationId, agentId);
        } else if (this.autoAssignmentConfig.enabled) {
            // Asignación automática
            return await this.autoAssignAgent(conversationId);
        }

        return null;
    }

    private async manualAssignAgent(conversationId: string, agentId: string): Promise<string | null> {
        const session = this.activeSessions.get(agentId);
        if (!session || session.status !== 'available') {
            throw new Error('Agente no disponible para asignación');
        }

        if (session.currentConversations >= session.maxConversations) {
            throw new Error('Agente ha alcanzado el máximo de conversaciones');
        }

        const agent = await this.db.findOne('crmUsers', { id: agentId });
        if (!agent) {
            throw new Error('Agente no encontrado');
        }

        // Actualizar conversación
        await this.db.updateOne(
            'conversations',
            { id: conversationId },
            {
                $set: {
                    assignedAgentId: agentId,
                    assignedAgent: agent,
                    updatedAt: new Date()
                }
            }
        );

        // Actualizar contador de conversaciones del agente
        session.currentConversations++;
        await this.db.updateOne(
            'agentSessions',
            { agentId, isActive: true },
            { $inc: { currentConversations: 1 } }
        );

        this.emit('agentAssigned', { conversationId, agentId, agent: agent.username });
        return agentId;
    }

    private async autoAssignAgent(conversationId: string): Promise<string | null> {
        // Obtener agentes disponibles
        const availableAgents = Array.from(this.activeSessions.values())
            .filter(session =>
                session.isActive &&
                session.status === 'available' &&
                session.currentConversations < session.maxConversations
            );

        if (availableAgents.length === 0) {
            return null;
        }

        let selectedAgent: AgentSession;

        if (this.autoAssignmentConfig.rules.byWorkload) {
            // Asignar al agente con menos conversaciones
            selectedAgent = availableAgents.reduce((prev, current) =>
                prev.currentConversations <= current.currentConversations ? prev : current
            );
        } else if (this.autoAssignmentConfig.rules.roundRobin) {
            // Asignación por rotación (simplificada)
            const randomIndex = Math.floor(Math.random() * availableAgents.length);
            selectedAgent = availableAgents[randomIndex];
        } else {
            // Asignación al primer agente disponible
            selectedAgent = availableAgents[0];
        }

        return await this.manualAssignAgent(conversationId, selectedAgent.agentId);
    }

    async unassignAgentFromConversation(conversationId: string): Promise<boolean> {
        const conversation = await this.db.findOne('conversations', { id: conversationId });
        if (!conversation?.assignedAgentId) return false;

        const agentId = conversation.assignedAgentId;
        const session = this.activeSessions.get(agentId);

        // Actualizar conversación
        await this.db.updateOne(
            'conversations',
            { id: conversationId },
            {
                $unset: { assignedAgentId: 1, assignedAgent: 1 },
                $set: { updatedAt: new Date() }
            }
        );

        // Actualizar contador de conversaciones del agente
        if (session && session.currentConversations > 0) {
            session.currentConversations--;
            await this.db.updateOne(
                'agentSessions',
                { agentId, isActive: true },
                { $inc: { currentConversations: -1 } }
            );
        }

        this.emit('agentUnassigned', { conversationId, agentId });
        return true;
    }

    /**
     * Detección automática de flujos de chat
     */
    async detectAndCategorizeFlow(conversationId: string, lastMessage: string): Promise<void> {
        const flowDetection = await this.analyzeMessageFlow(lastMessage);

        if (flowDetection.flowType) {
            await this.db.updateOne(
                'conversations',
                { id: conversationId },
                {
                    $set: {
                        flowType: flowDetection.flowType,
                        originalFlow: flowDetection.originalFlow,
                        updatedAt: new Date()
                    }
                }
            );            // Agregar etiquetas automáticas basadas en el flujo
            if (flowDetection.suggestedTags && flowDetection.suggestedTags.length > 0) {
                await this.addTagsToConversation(conversationId, flowDetection.suggestedTags);
            }

            this.emit('flowDetected', { conversationId, ...flowDetection });
        }
    }

    private async analyzeMessageFlow(message: string): Promise<{
        flowType?: string;
        originalFlow?: string;
        suggestedTags?: string[];
    }> {
        const lowercaseMessage = message.toLowerCase();

        // Detección de patrones comunes
        if (lowercaseMessage.includes('factura') || lowercaseMessage.includes('pago') || lowercaseMessage.includes('cobro')) {
            return {
                flowType: 'billing',
                originalFlow: 'Consulta de Facturación',
                suggestedTags: ['billing']
            };
        }

        if (lowercaseMessage.includes('técnico') || lowercaseMessage.includes('internet') || lowercaseMessage.includes('conexión')) {
            return {
                flowType: 'technical',
                originalFlow: 'Soporte Técnico',
                suggestedTags: ['technical', 'support']
            };
        }

        if (lowercaseMessage.includes('comercial') || lowercaseMessage.includes('plan') || lowercaseMessage.includes('contratar')) {
            return {
                flowType: 'commercial',
                originalFlow: 'Consulta Comercial',
                suggestedTags: ['commercial']
            };
        }

        if (lowercaseMessage.includes('urgente') || lowercaseMessage.includes('emergencia')) {
            return {
                flowType: 'urgent',
                originalFlow: 'Consulta Urgente',
                suggestedTags: ['urgent']
            };
        }

        return {};
    }

    /**
     * Métricas y reportes
     */
    async getAgentMetrics(): Promise<any> {
        const activeSessions = Array.from(this.activeSessions.values());
        const totalAgents = activeSessions.length;
        const availableAgents = activeSessions.filter(s => s.status === 'available').length;
        const busyAgents = activeSessions.filter(s => s.status === 'busy').length;
        const totalConversations = activeSessions.reduce((sum, s) => sum + s.currentConversations, 0);

        return {
            totalAgents,
            availableAgents,
            busyAgents,
            totalConversations,
            averageConversationsPerAgent: totalAgents > 0 ? totalConversations / totalAgents : 0,
            sessions: activeSessions
        };
    }

    async getTagUsageStats(): Promise<any> {
        try {
            const tags = await this.getAllTags();
            const conversations = await this.db.find('conversations', {});

            const stats = tags.map(tag => {
                const usageCount = conversations.filter(conv =>
                    conv.tags && conv.tags.some((t: any) => t.id === tag.id)
                ).length;

                return {
                    ...tag,
                    usageCount
                };
            });

            return {
                totalTags: tags.length,
                totalUsages: stats.reduce((sum, tag) => sum + tag.usageCount, 0),
                tagStats: stats.sort((a, b) => b.usageCount - a.usageCount)
            };
        } catch (error) {
            console.error('Error calculating tag usage stats:', error);
            return {
                totalTags: 0,
                totalUsages: 0,
                tagStats: []
            };
        }
    }

    /**
     * Obtiene estadísticas de prioridades de conversaciones
     */
    async getPriorityStats(): Promise<any> {
        try {
            const conversations = await this.db.find('conversations', {});
            const priorityDistribution: { [key: number]: { count: number; label: string } } = {
                1: { count: 0, label: 'Normal' },
                2: { count: 0, label: 'Baja' },
                3: { count: 0, label: 'Media' },
                4: { count: 0, label: 'Alta' },
                5: { count: 0, label: 'Crítica' }
            };

            let totalConversations = 0;
            let averagePriority = 0;

            conversations.forEach(conv => {
                const priority = conv.priority || 1;
                if (priorityDistribution[priority]) {
                    priorityDistribution[priority].count++;
                }
                totalConversations++;
                averagePriority += priority;
            });

            averagePriority = totalConversations > 0 ? averagePriority / totalConversations : 1;

            // Conversaciones de alta prioridad (4 y 5)
            const highPriorityCount = priorityDistribution[4].count + priorityDistribution[5].count;
            const highPriorityPercentage = totalConversations > 0
                ? Math.round((highPriorityCount / totalConversations) * 100)
                : 0;

            return {
                totalConversations,
                averagePriority: Math.round(averagePriority * 100) / 100,
                distribution: priorityDistribution,
                highPriorityCount,
                highPriorityPercentage
            };
        } catch (error) {
            console.error('Error calculating priority stats:', error);
            return {
                totalConversations: 0,
                averagePriority: 1,
                distribution: {},
                highPriorityCount: 0,
                highPriorityPercentage: 0
            };
        }
    }
}

export default ConversationEnhancementService;

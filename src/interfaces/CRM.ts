/**
 * Modelo de datos para el CRM
 */

export interface CRMUser {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'supervisor' | 'agent';
    isActive: boolean;
    lastLogin?: Date;
    profile?: {
        firstName: string;
        lastName: string;
        avatar?: string;
        department?: string;
        phoneExtension?: string;
    };
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Conversation {
    id: string;
    phoneNumber: string;
    customerName?: string;
    customerInfo?: {
        serviceId?: string;
        email?: string;
        address?: string;
        plan?: string;
        status?: 'active' | 'inactive' | 'suspended';
    };
    status: 'active' | 'closed' | 'pending' | 'transferred' | 'escalated';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignedAgentId?: string;
    assignedAgent?: CRMUser;
    source: 'whatsapp' | 'web' | 'email' | 'phone';

    // Bot interaction data
    botActive: boolean;
    lastBotInteraction?: Date;
    botSessionData?: any;
    handoverReason?: string;
    handoverTimestamp?: Date;

    // Conversation metrics
    messageCount: number;
    avgResponseTime?: number;
    firstResponseTime?: number;
    resolutionTime?: number;

    // Business context
    category?: string;
    subcategory?: string;
    tags: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    satisfaction?: number; // 1-5

    createdAt: Date;
    updatedAt: Date;
    lastMessageAt: Date;
    closedAt?: Date;
    metadata: Record<string, any>;
}

export interface Message {
    id: string;
    conversationId: string;
    messageId?: string; // WhatsApp message ID

    // Message content
    content?: string;
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'interactive' | 'system';
    mediaUrl?: string;
    mediaCaption?: string;

    // Sender info
    fromNumber: string;
    toNumber: string;
    isFromBot: boolean;
    isFromCustomer: boolean;
    agentId?: string;

    // Bot context
    botFlow?: string;
    botIntent?: string;
    botConfidence?: number;
    aiProcessed: boolean;

    // Message metadata
    readAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    errorMessage?: string;

    timestamp: Date;
    createdAt: Date;
    metadata: Record<string, any>;
}

export interface Ticket {
    id: string;
    title: string; // Para compatibilidad con el código existente
    conversationId?: string;
    ticketNumber?: string;
    customerPhone?: string;

    // Ticket details
    subject?: string;
    description: string;
    category: string;
    subcategory?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated';

    // Assignment
    assignedTo?: string; // Para compatibilidad
    assignedAgentId?: string;
    assignedAgent?: CRMUser;
    createdBy?: string; // Para compatibilidad
    createdById?: string;

    // Resolution
    resolution?: string;
    resolvedAt?: Date;
    resolvedById?: string;
    resolvedBy?: CRMUser;

    // Escalation
    escalatedAt?: Date;
    escalatedTo?: string;
    escalationReason?: string;

    // SLA tracking
    slaDeadline?: Date;
    slaBreached?: boolean;

    createdAt: Date;
    updatedAt: Date;
}

export interface ConversationNote {
    id: string;
    conversationId: string;
    agentId: string;
    agent?: CRMUser;
    note: string;
    isPrivate: boolean;
    noteType: 'info' | 'warning' | 'action' | 'resolution';
    createdAt: Date;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    category?: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
}

export interface AgentMetrics {
    agentId: string;
    assignedConversations: number;
    totalConversations: number;
    resolvedConversations: number;
    avgResponseTime: number;
    messagesSent: number;
    customerSatisfactionRating: number;
    activeSince: Date;
    lastActivity: Date;
    conversationsByStatus: Record<string, number>;
    responseTimeByHour: Record<string, number>;
    dailyActivity: Array<{
        date: string;
        conversations: number;
        messages: number;
        avgResponseTime: number;
    }>;
}

export interface CRMDashboardData {
    // Estadísticas principales
    stats: {
        totalConversations: number;
        activeConversations: number;
        pendingConversations: number;
        totalMessages: number;
        totalAgents: number;
        responseTimeAvg: number;
        resolutionRate: number;
    };

    // Conversaciones recientes
    recentConversations: Conversation[];

    // Performance de agentes
    agentsPerformance: any[];

    // Datos por hora
    messagesByHour: any[];

    // Distribución por estado
    conversationsByStatus: Record<string, number>;
}

export interface ConversationFilter {
    page?: number;
    limit?: number;
    status?: 'active' | 'closed' | 'pending' | 'transferred' | 'escalated';
    assignedTo?: string;
    phoneNumber?: string;
    startDate?: Date;
    endDate?: Date;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
}

export interface MessageFilter {
    page?: number;
    limit?: number;
    messageType?: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'interactive';
    fromBot?: boolean;
    startDate?: Date;
    endDate?: Date;
    hasAttachments?: boolean;
}

export interface BotControlCommand {
    type: 'enable' | 'disable' | 'restart' | 'update_config' | 'force_handover' | 'resume_bot';
    target?: string; // phoneNumber for specific user commands
    parameters?: Record<string, any>;
    executedBy: string; // agent ID
    executedAt: Date;
    result?: {
        success: boolean;
        message: string;
        data?: any;
    };
}

export interface HandoverRequest {
    phoneNumber: string;
    reason: 'customer_request' | 'bot_limitation' | 'escalation' | 'manual' | 'error';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    context?: {
        botFlow?: string;
        customerIntent?: string;
        previousMessages?: Message[];
        urgency?: 'low' | 'medium' | 'high';
    };
}

// Export all interfaces
export * from './CRM';

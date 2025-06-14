// Tipos compartidos entre frontend y backend
export interface User {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'agent' | 'supervisor';
    isActive: boolean;
    createdAt: string;
}

export interface Conversation {
    id: string;
    phoneNumber: string;
    customerName?: string;
    status: 'active' | 'closed' | 'pending' | 'transferred';
    assignedAgentId?: string;
    assignedAgentName?: string;
    lastMessageAt: string;
    createdAt: string;
    unreadCount?: number;
    tags?: string[];
}

export interface Message {
    id: string;
    conversationId: string;
    content: string;
    type: 'text' | 'image' | 'document' | 'audio' | 'system';
    direction: 'inbound' | 'outbound';
    senderId?: string;
    senderName?: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    metadata?: {
        whatsappMessageId?: string;
        fileName?: string;
        mediaUrl?: string;
    };
}

export interface RealTimeMetrics {
    activeConversations: number;
    pendingMessages: number;
    onlineAgents: number;
    todayMessages: number;
    averageResponseTime: number;
    lastUpdated: string;
}

export interface ConversationStats {
    totalConversations: number;
    activeConversations: number;
    closedConversations: number;
    averageHandlingTime: number;
    customerSatisfaction: number;
}

export interface AgentStats {
    agentId: string;
    agentName: string;
    totalConversations: number;
    activeConversations: number;
    averageResponseTime: number;
    handledMessages: number;
    isOnline: boolean;
}

export interface WebSocketEvent {
    type: 'new_message' | 'conversation_update' | 'agent_status' | 'metrics_update';
    data: any;
    timestamp: string;
}

export interface MessageFilter {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    agentId?: string;
    status?: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse {
    data: T[];
    pagination: {
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
}

// Helper para acceder a los datos de la API de forma segura
export const getApiData = <T>(response: ApiResponse<T> | undefined): T | undefined => {
    return response?.data;
};

// Helpers para acceso seguro a datos específicos
export const getMetrics = (response: ApiResponse<RealTimeMetrics> | undefined): RealTimeMetrics | undefined => {
    return response?.data;
};

export const getConversationStats = (response: ApiResponse<ConversationStats> | undefined): ConversationStats | undefined => {
    return response?.data;
};

export const getMessageStats = (response: ApiResponse<any> | undefined): any | undefined => {
    return response?.data;
};

export const getAgentStats = (response: ApiResponse<AgentStats[]> | undefined): AgentStats[] | undefined => {
    return response?.data;
};

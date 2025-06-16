import { useState, useCallback } from 'react';
import type { ConversationTag, Agent } from '../types';

const API_BASE_URL = '/api/enhancement';

interface UseConversationEnhancementReturn {
    // Tags
    tags: ConversationTag[];
    isLoadingTags: boolean;
    createTag: (tag: Omit<ConversationTag, 'id' | 'createdAt'>) => Promise<ConversationTag>;
    updateTag: (tagId: string, updates: Partial<ConversationTag>) => Promise<ConversationTag | null>;
    deleteTag: (tagId: string) => Promise<boolean>;
    loadTags: (category?: string) => Promise<void>;

    // Conversation Tags
    addTagsToConversation: (conversationId: string, tagIds: string[]) => Promise<boolean>;
    removeTagsFromConversation: (conversationId: string, tagIds: string[]) => Promise<boolean>;

    // Agent Management
    agents: Agent[];
    isLoadingAgents: boolean;
    startAgentSession: (agentId: string, sessionId: string, maxConversations?: number) => Promise<boolean>;
    updateAgentStatus: (agentId: string, status: string) => Promise<boolean>;
    endAgentSession: (agentId: string) => Promise<boolean>;

    // Agent Assignment
    assignAgentToConversation: (conversationId: string, agentId?: string) => Promise<string | null>;
    unassignAgentFromConversation: (conversationId: string) => Promise<boolean>;

    // Analytics
    getAgentMetrics: () => Promise<any>;
    getTagStats: () => Promise<any>;
}

export const useConversationEnhancement = (): UseConversationEnhancementReturn => {
    const [tags, setTags] = useState<ConversationTag[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [agents] = useState<Agent[]>([]);
    const [isLoadingAgents] = useState(false);

    // Para evitar warnings
    void agents;
    void isLoadingAgents;

    // Helper function for API calls
    const apiCall = async (endpoint: string, options: RequestInit = {}) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    };

    // Tag Management
    const loadTags = useCallback(async (category?: string) => {
        setIsLoadingTags(true);
        try {
            const queryParam = category ? `?category=${category}` : '';
            const response = await apiCall(`/tags${queryParam}`);
            setTags(response.data || []);
        } catch (error) {
            console.error('Error loading tags:', error);
            throw error;
        } finally {
            setIsLoadingTags(false);
        }
    }, []);

    const createTag = useCallback(async (tagData: Omit<ConversationTag, 'id' | 'createdAt'>) => {
        const response = await apiCall('/tags', {
            method: 'POST',
            body: JSON.stringify(tagData),
        });

        const newTag = response.data;
        setTags(prev => [...prev, newTag]);
        return newTag;
    }, []);

    const updateTag = useCallback(async (tagId: string, updates: Partial<ConversationTag>) => {
        const response = await apiCall(`/tags/${tagId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });

        const updatedTag = response.data;
        if (updatedTag) {
            setTags(prev => prev.map(tag => tag.id === tagId ? updatedTag : tag));
        }
        return updatedTag;
    }, []);

    const deleteTag = useCallback(async (tagId: string) => {
        await apiCall(`/tags/${tagId}`, {
            method: 'DELETE',
        });

        setTags(prev => prev.filter(tag => tag.id !== tagId));
        return true;
    }, []);

    // Conversation Tag Management
    const addTagsToConversation = useCallback(async (conversationId: string, tagIds: string[]) => {
        await apiCall(`/conversations/${conversationId}/tags`, {
            method: 'POST',
            body: JSON.stringify({ tagIds }),
        });
        return true;
    }, []);

    const removeTagsFromConversation = useCallback(async (conversationId: string, tagIds: string[]) => {
        await apiCall(`/conversations/${conversationId}/tags`, {
            method: 'DELETE',
            body: JSON.stringify({ tagIds }),
        });
        return true;
    }, []);

    // Agent Session Management
    const startAgentSession = useCallback(async (agentId: string, sessionId: string, maxConversations = 5) => {
        await apiCall(`/agents/${agentId}/session`, {
            method: 'POST',
            body: JSON.stringify({ sessionId, maxConversations }),
        });
        return true;
    }, []);

    const updateAgentStatus = useCallback(async (agentId: string, status: string) => {
        await apiCall(`/agents/${agentId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
        return true;
    }, []);

    const endAgentSession = useCallback(async (agentId: string) => {
        await apiCall(`/agents/${agentId}/session`, {
            method: 'DELETE',
        });
        return true;
    }, []);

    // Agent Assignment
    const assignAgentToConversation = useCallback(async (conversationId: string, agentId?: string) => {
        const response = await apiCall(`/conversations/${conversationId}/assign`, {
            method: 'POST',
            body: JSON.stringify({ agentId }),
        });
        return response.data?.assignedAgentId || null;
    }, []);

    const unassignAgentFromConversation = useCallback(async (conversationId: string) => {
        await apiCall(`/conversations/${conversationId}/assign`, {
            method: 'DELETE',
        });
        return true;
    }, []);

    // Analytics
    const getAgentMetrics = useCallback(async () => {
        const response = await apiCall('/agents/metrics');
        return response.data;
    }, []);

    const getTagStats = useCallback(async () => {
        const response = await apiCall('/tags/stats');
        return response.data;
    }, []);

    return {
        // Tags
        tags,
        isLoadingTags,
        createTag,
        updateTag,
        deleteTag,
        loadTags,

        // Conversation Tags
        addTagsToConversation,
        removeTagsFromConversation,

        // Agent Management
        agents,
        isLoadingAgents,
        startAgentSession,
        updateAgentStatus,
        endAgentSession,

        // Agent Assignment
        assignAgentToConversation,
        unassignAgentFromConversation,

        // Analytics
        getAgentMetrics,
        getTagStats,
    };
};

export default useConversationEnhancement;

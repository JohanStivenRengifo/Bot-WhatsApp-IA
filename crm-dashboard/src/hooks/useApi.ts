import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { webSocketService } from '../services/websocket';
import { useEffect } from 'react';

// Hook para conversaciones
export const useConversations = (params?: any) => {
    return useQuery({
        queryKey: ['conversations', params],
        queryFn: async () => {
            const response = await apiClient.getConversations(params);
            return response.data;
        },
        refetchInterval: 30000, // Refrescar cada 30 segundos
        staleTime: 15000, // Considerar stale después de 15 segundos
    });
};

// Hook para una conversación específica
export const useConversation = (id: string) => {
    return useQuery({
        queryKey: ['conversation', id],
        queryFn: async () => {
            const response = await apiClient.getConversationById(id);
            return response.data;
        },
        enabled: !!id,
    });
};

// Hook para mensajes de conversación
export const useConversationMessages = (conversationId: string, params?: any) => {
    return useQuery({
        queryKey: ['conversation-messages', conversationId, params],
        queryFn: async () => {
            const response = await apiClient.getConversationMessages(conversationId, params);
            return response.data;
        },
        enabled: !!conversationId,
        refetchInterval: 10000, // Refrescar cada 10 segundos
    });
};

// Hook para enviar mensajes
export const useSendMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
            const response = await apiClient.sendMessage(conversationId, message);
            return response.data;
        }, onSuccess: (_, variables) => {
            // Invalidar queries relacionadas
            queryClient.invalidateQueries({ queryKey: ['conversation-messages', variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
};

// Hook para asignar conversación
export const useAssignConversation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId: string }) => {
            const response = await apiClient.assignConversation(conversationId, agentId);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
};

// Hook para actualizar estado de conversación
export const useUpdateConversationStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, status }: { conversationId: string; status: string }) => {
            const response = await apiClient.updateConversationStatus(conversationId, status);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
};

// Hook para agentes
export const useAgents = () => {
    return useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const response = await apiClient.getAgents();
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
};

// Hook para métricas en tiempo real
export const useRealTimeMetrics = () => {
    const queryClient = useQueryClient(); const query = useQuery({
        queryKey: ['realtime-metrics'],
        queryFn: async () => {
            const response = await apiClient.getRealTimeMetrics();
            return response;
        },
        refetchInterval: 5000, // Refrescar cada 5 segundos
    });

    // Escuchar actualizaciones de WebSocket
    useEffect(() => {
        const handleMetricsUpdate = (data: any) => {
            queryClient.setQueryData(['realtime-metrics'], data);
        };

        webSocketService.on('metrics_update', handleMetricsUpdate);

        return () => {
            webSocketService.off('metrics_update', handleMetricsUpdate);
        };
    }, [queryClient]);

    return query;
};

// Hook para estadísticas de conversaciones
// Hook para estadísticas de conversaciones
export const useConversationStats = (params?: any) => {
    return useQuery({
        queryKey: ['conversation-stats', params],
        queryFn: async () => {
            const response = await apiClient.getConversationStats(params);
            return response;
        },
        staleTime: 2 * 60 * 1000, // 2 minutos
    });
};

// Hook para estadísticas de agentes
export const useAgentStats = (params?: any) => {
    return useQuery({
        queryKey: ['agent-stats', params],
        queryFn: async () => {
            const response = await apiClient.getAgentStats(params);
            return response;
        },
        staleTime: 2 * 60 * 1000, // 2 minutos
    });
};

// Hook para estadísticas de mensajes
export const useMessageStats = (params?: any) => {
    return useQuery({
        queryKey: ['message-stats', params],
        queryFn: async () => {
            const response = await apiClient.getMessageStats(params);
            return response;
        },
        staleTime: 2 * 60 * 1000, // 2 minutos
    });
};

// Hook para WebSocket events
export const useWebSocketEvents = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleNewMessage = (data: any) => {
            // Invalidar mensajes de la conversación afectada
            queryClient.invalidateQueries({
                queryKey: ['conversation-messages', data.conversationId]
            });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        };

        const handleConversationUpdate = (data: any) => {
            // Actualizar conversación específica
            queryClient.invalidateQueries({
                queryKey: ['conversation', data.conversationId]
            });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        };

        webSocketService.on('new_message', handleNewMessage);
        webSocketService.on('conversation_update', handleConversationUpdate);

        return () => {
            webSocketService.off('new_message', handleNewMessage);
            webSocketService.off('conversation_update', handleConversationUpdate);
        };
    }, [queryClient]);

    return {
        isConnected: webSocketService.isConnected,
        status: webSocketService.status
    };
};

// Hook para el usuario actual
export const useCurrentUser = () => {
    return useQuery({
        queryKey: ['current-user'],
        queryFn: async () => {
            const response = await apiClient.getCurrentUser();
            return response.data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutos
        retry: false, // No reintentar en caso de error de auth
    });
};

// Hook para finalizar conversación
export const useEndConversation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, reason }: { conversationId: string; reason?: string }) => {
            const response = await apiClient.endConversation(conversationId, reason);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['conversation-messages', variables.conversationId] });
        },
    });
};

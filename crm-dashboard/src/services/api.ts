import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { ApiResponse, PaginatedResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor para añadir token
        this.client.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor para manejar errores
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    localStorage.removeItem('auth_token');
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
        );
    }

    // Métodos genéricos
    async get<T>(url: string, params?: any): Promise<AxiosResponse<T>> {
        return this.client.get(url, { params });
    }

    async post<T>(url: string, data?: any): Promise<AxiosResponse<T>> {
        return this.client.post(url, data);
    }

    async put<T>(url: string, data?: any): Promise<AxiosResponse<T>> {
        return this.client.put(url, data);
    }

    async delete<T>(url: string): Promise<AxiosResponse<T>> {
        return this.client.delete(url);
    }    // Métodos específicos de autenticación
    async login(email: string, password: string) {
        return this.post<ApiResponse<{ token: string; user: any }>>('/api/crm/auth/login', {
            email,
            password,
        });
    }

    async logout() {
        return this.post<ApiResponse>('/api/crm/auth/logout');
    } async getCurrentUser() {
        return this.get<ApiResponse<any>>('/api/crm/auth/me');
    }

    // Métodos de dashboard
    async getDashboard() {
        return this.get<ApiResponse<any>>('/api/crm/dashboard');
    }

    // Métodos de conversaciones
    async getConversations(params?: any) {
        return this.get<PaginatedResponse<any>>('/api/crm/conversations', params);
    }

    async getConversationById(id: string) {
        return this.get<ApiResponse<any>>(`/api/crm/conversations/${id}`);
    }

    async getConversationMessages(id: string, params?: any) {
        return this.get<ApiResponse<any>>(`/api/crm/conversations/${id}/messages-full`, params);
    }

    async sendMessage(conversationId: string, message: string) {
        return this.post<ApiResponse>(`/api/crm/conversations/${conversationId}/send-message`, {
            message,
        });
    }

    async assignConversation(conversationId: string, agentId: string) {
        return this.put<ApiResponse>(`/api/crm/conversations/${conversationId}/assign`, {
            agentId,
        });
    }

    async updateConversationStatus(conversationId: string, status: string) {
        return this.put<ApiResponse>(`/api/crm/conversations/${conversationId}/status`, {
            status,
        });
    }

    async endConversation(conversationId: string, reason?: string) {
        return this.post<ApiResponse>(`/api/crm/conversations/${conversationId}/end-conversation`, {
            reason: reason || 'agent_ended_conversation',
        });
    }

    // Métodos de usuarios/agentes
    async getAgents() {
        return this.get<ApiResponse<any[]>>('/api/crm/agents');
    }

    async createAgent(agent: any) {
        return this.post<ApiResponse<any>>('/api/crm/agents', agent);
    }

    async updateAgent(id: string, agent: any) {
        return this.put<ApiResponse<any>>(`/api/crm/agents/${id}`, agent);
    }

    async deleteAgent(id: string) {
        return this.delete<ApiResponse>(`/api/crm/agents/${id}`);
    }

    // Métodos de analytics
    async getRealTimeMetrics() {
        return this.get<ApiResponse<any>>('/api/crm/metrics/realtime');
    }

    async getConversationStats(params?: any) {
        return this.get<ApiResponse<any>>('/api/crm/stats/conversations', params);
    }

    async getAgentStats(params?: any) {
        return this.get<ApiResponse<any[]>>('/api/crm/stats/agents', params);
    }

    async getMessageStats(params?: any) {
        return this.get<ApiResponse<any>>('/api/crm/stats/messages', params);
    }

    // WebSocket stats
    async getWebSocketStats() {
        return this.get<ApiResponse<any>>('/api/crm/websocket/stats');
    }

    async sendNotification(data: any) {
        return this.post<ApiResponse>('/api/crm/notifications/send', data);
    }

    // Métodos de configuración del sistema
    async getSystemSettings() {
        return this.get<ApiResponse<any>>('/api/crm/settings');
    }

    async updateSystemSettings(settings: any) {
        return this.post<ApiResponse<any>>('/api/crm/settings', settings);
    }
}

export const apiClient = new ApiClient();
export default apiClient;

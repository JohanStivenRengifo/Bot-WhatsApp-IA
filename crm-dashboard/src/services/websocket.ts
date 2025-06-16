import { io, Socket } from 'socket.io-client';
// import type { WebSocketEvent, RealTimeMetrics } from '../types';

class WebSocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, ((data: any) => void)[]> = new Map();
    private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    constructor() {
        this.connect();
    } private connect() {
        if (this.socket?.connected) return;

        this.connectionStatus = 'connecting';
        const token = localStorage.getItem('auth_token');

        // Si no hay token, no intentar conectar
        if (!token) {
            console.log('⚠️ No hay token de autenticación, no se puede conectar al WebSocket');
            this.connectionStatus = 'disconnected';
            return;
        }

        this.socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
            auth: {
                token
            },
            transports: ['websocket'],
            upgrade: true,
            rememberUpgrade: true,
        });

        this.setupEventListeners();
    }

    private setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('🔌 WebSocket conectado');
            this.connectionStatus = 'connected';
            this.reconnectAttempts = 0;
            this.emit('connection_status', { status: 'connected' });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 WebSocket desconectado:', reason);
            this.connectionStatus = 'disconnected';
            this.emit('connection_status', { status: 'disconnected', reason });

            if (reason === 'io server disconnect') {
                // Reconectar si el servidor nos desconectó
                this.reconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Error de conexión WebSocket:', error);
            this.emit('connection_error', { error: error.message });
            this.reconnect();
        });

        // Eventos específicos del CRM
        this.socket.on('new_message', (data) => {
            console.log('📨 Nuevo mensaje recibido:', data);
            this.emit('new_message', data);
        });

        this.socket.on('conversation_update', (data) => {
            console.log('💬 Conversación actualizada:', data);
            this.emit('conversation_update', data);
        });

        this.socket.on('agent_status_change', (data) => {
            console.log('👤 Estado de agente cambiado:', data);
            this.emit('agent_status_change', data);
        });

        this.socket.on('metrics_update', (data) => {
            console.log('📊 Métricas actualizadas:', data);
            this.emit('metrics_update', data);
        });

        this.socket.on('notification', (data) => {
            console.log('🔔 Notificación recibida:', data);
            this.emit('notification', data);
        });
    }

    private reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Máximo de intentos de reconexión alcanzado');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    // Métodos públicos
    on(event: string, callback: (data: any) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: string, callback?: (data: any) => void) {
        if (!this.listeners.has(event)) return;

        if (callback) {
            const callbacks = this.listeners.get(event)!;
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        } else {
            this.listeners.delete(event);
        }
    }

    private emit(event: string, data: any) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error en callback de evento ${event}:`, error);
            }
        });
    }

    // Enviar eventos al servidor
    sendMessage(conversationId: string, message: string) {
        if (!this.socket?.connected) {
            console.warn('⚠️ WebSocket no está conectado');
            return;
        }

        this.socket.emit('send_message', {
            conversationId,
            message,
            timestamp: new Date().toISOString()
        });
    }

    joinConversation(conversationId: string) {
        if (!this.socket?.connected) return;
        this.socket.emit('join_conversation', { conversationId });
    }

    leaveConversation(conversationId: string) {
        if (!this.socket?.connected) return;
        this.socket.emit('leave_conversation', { conversationId });
    }

    updateAgentStatus(status: 'online' | 'offline' | 'busy') {
        if (!this.socket?.connected) return;
        this.socket.emit('agent_status', { status });
    }

    // Método para reconectar después del login
    reconnectWithAuth() {
        console.log('🔌 Reconectando WebSocket con autenticación...');
        this.disconnect();
        this.connect();
    }

    // Getters
    get isConnected(): boolean {
        return this.connectionStatus === 'connected';
    }

    get status(): string {
        return this.connectionStatus;
    }

    // Cleanup
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.listeners.clear();
        this.connectionStatus = 'disconnected';
    }
}

// Singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;

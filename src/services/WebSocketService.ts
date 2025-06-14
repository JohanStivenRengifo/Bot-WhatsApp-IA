import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { CRMUser } from '../interfaces/CRM';

export interface SocketUser {
    id: string;
    userId: number;
    userInfo: CRMUser;
    rooms: string[];
}

export class WebSocketService {
    private static instance: WebSocketService;
    private io: SocketIOServer | null = null;
    private connectedUsers: Map<string, SocketUser> = new Map();

    private constructor() { }

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    /**
     * Inicializar WebSocket server
     */
    public initialize(httpServer: HTTPServer): void {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:5173",
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        // Middleware de autenticación para WebSocket
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Token de autenticación requerido'));
            }

            try {
                const decoded = jwt.verify(token, config.JWT_SECRET) as any;
                socket.data.user = {
                    id: decoded.id,
                    email: decoded.email,
                    role: decoded.role
                };
                next();
            } catch (error) {
                next(new Error('Token inválido'));
            }
        });

        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        console.log('🚀 WebSocket server inicializado');
    }

    /**
     * Manejar nueva conexión
     */
    private handleConnection(socket: any): void {
        const user = socket.data.user;

        console.log(`👤 Usuario conectado: ${user.email} (${user.role})`);

        // Registrar usuario conectado
        const socketUser: SocketUser = {
            id: socket.id,
            userId: user.id,
            userInfo: user,
            rooms: []
        };

        this.connectedUsers.set(socket.id, socketUser);

        // Unirse a sala por rol
        const roleRoom = `role:${user.role}`;
        socket.join(roleRoom);
        socketUser.rooms.push(roleRoom);

        // Unirse a sala personal
        const userRoom = `user:${user.id}`;
        socket.join(userRoom);
        socketUser.rooms.push(userRoom);

        // Eventos del socket
        socket.on('join_conversation', (conversationId: string) => {
            this.handleJoinConversation(socket, conversationId);
        });

        socket.on('leave_conversation', (conversationId: string) => {
            this.handleLeaveConversation(socket, conversationId);
        });

        socket.on('agent_status_update', (status: 'online' | 'away' | 'busy') => {
            this.handleAgentStatusUpdate(socket, status);
        });

        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });

        // Enviar estado inicial
        socket.emit('connection_established', {
            userId: user.id,
            role: user.role,
            connectedAgents: this.getConnectedAgentsCount()
        });
    }

    /**
     * Unirse a conversación específica
     */
    private handleJoinConversation(socket: any, conversationId: string): void {
        const conversationRoom = `conversation:${conversationId}`;
        socket.join(conversationRoom);

        const socketUser = this.connectedUsers.get(socket.id);
        if (socketUser) {
            socketUser.rooms.push(conversationRoom);
        }

        console.log(`👤 ${socket.data.user.email} se unió a conversación ${conversationId}`);
    }

    /**
     * Salir de conversación específica
     */
    private handleLeaveConversation(socket: any, conversationId: string): void {
        const conversationRoom = `conversation:${conversationId}`;
        socket.leave(conversationRoom);

        const socketUser = this.connectedUsers.get(socket.id);
        if (socketUser) {
            socketUser.rooms = socketUser.rooms.filter(room => room !== conversationRoom);
        }
    }

    /**
     * Actualizar estado del agente
     */
    private handleAgentStatusUpdate(socket: any, status: 'online' | 'away' | 'busy'): void {
        const user = socket.data.user;

        // Notificar a supervisores y admins
        this.io?.to('role:supervisor').to('role:admin').emit('agent_status_changed', {
            agentId: user.id,
            email: user.email,
            status,
            timestamp: new Date()
        });
    }

    /**
     * Manejar desconexión
     */
    private handleDisconnection(socket: any): void {
        const user = socket.data.user;
        console.log(`👤 Usuario desconectado: ${user.email}`);

        this.connectedUsers.delete(socket.id);

        // Notificar cambio de estado a supervisores
        this.io?.to('role:supervisor').to('role:admin').emit('agent_status_changed', {
            agentId: user.id,
            email: user.email,
            status: 'offline',
            timestamp: new Date()
        });
    }

    /**
     * NOTIFICACIONES PARA EL CRM
     */

    /**
     * Notificar nuevo handover
     */
    public notifyNewHandover(handover: any): void {
        if (!this.io) return;

        // Notificar a todos los agentes disponibles
        this.io.to('role:agent').to('role:supervisor').to('role:admin').emit('new_handover', {
            type: 'handover_request',
            data: handover,
            timestamp: new Date()
        });
    }

    /**
     * Notificar handover aceptado
     */
    public notifyHandoverAccepted(conversationId: string, agentId: number): void {
        if (!this.io) return;

        // Notificar al agente específico
        this.io.to(`user:${agentId}`).emit('handover_accepted', {
            type: 'handover_accepted',
            conversationId,
            timestamp: new Date()
        });

        // Notificar a supervisores
        this.io.to('role:supervisor').to('role:admin').emit('handover_update', {
            type: 'handover_accepted',
            conversationId,
            agentId,
            timestamp: new Date()
        });
    }

    /**
     * Notificar nuevo mensaje en conversación
     */
    public notifyNewMessage(conversationId: string, message: any): void {
        if (!this.io) return;

        // Notificar a todos en la conversación
        this.io.to(`conversation:${conversationId}`).emit('new_message', {
            type: 'new_message',
            conversationId,
            message,
            timestamp: new Date()
        });
    }

    /**
     * Notificar cambio de estado de conversación
     */
    public notifyConversationStatusChange(conversationId: string, status: string, agentId?: number): void {
        if (!this.io) return;

        const notification = {
            type: 'conversation_status_change',
            conversationId,
            status,
            agentId,
            timestamp: new Date()
        };

        // Notificar a agente asignado si existe
        if (agentId) {
            this.io.to(`user:${agentId}`).emit('conversation_update', notification);
        }

        // Notificar a supervisores
        this.io.to('role:supervisor').to('role:admin').emit('conversation_update', notification);
    }

    /**
     * Notificar métricas actualizadas
     */
    public notifyMetricsUpdate(metrics: any): void {
        if (!this.io) return;

        this.io.to('role:supervisor').to('role:admin').emit('metrics_update', {
            type: 'metrics_update',
            data: metrics,
            timestamp: new Date()
        });
    }

    /**
     * Obtener estadísticas de conexiones
     */
    public getConnectionStats(): any {
        const stats = {
            totalConnections: this.connectedUsers.size,
            agentsByRole: {
                admin: 0,
                supervisor: 0,
                agent: 0
            },
            connectedUsers: Array.from(this.connectedUsers.values()).map(user => ({
                userId: user.userId,
                email: user.userInfo.email,
                role: user.userInfo.role
            }))
        };

        this.connectedUsers.forEach(user => {
            stats.agentsByRole[user.userInfo.role]++;
        });

        return stats;
    }

    /**
     * Obtener número de agentes conectados
     */
    private getConnectedAgentsCount(): number {
        let count = 0;
        this.connectedUsers.forEach(user => {
            if (user.userInfo.role === 'agent') count++;
        });
        return count;
    }

    /**
     * Enviar notificación a usuario específico
     */
    public sendToUser(userId: number, event: string, data: any): void {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(event, data);
    }

    /**
     * Enviar notificación a rol específico
     */
    public sendToRole(role: string, event: string, data: any): void {
        if (!this.io) return;
        this.io.to(`role:${role}`).emit(event, data);
    }

    /**
     * Broadcast a todos los usuarios conectados
     */
    public broadcast(event: string, data: any): void {
        if (!this.io) return;
        this.io.emit(event, data);
    }

    /**
     * Enviar mensaje a todos los usuarios en una sala específica
     */
    public broadcastToRoom(room: string, event: string, data: any): void {
        if (!this.io) {
            console.warn('WebSocket server no inicializado');
            return;
        }

        this.io.to(room).emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });

        console.log(`📡 Broadcast enviado a sala "${room}" - Evento: ${event}`);
    }

    /**
     * Enviar notificación a todos los agentes CRM
     */
    public notifyAllAgents(event: string, data: any): void {
        this.broadcastToRoom('crm-agents', event, data);
    }
}

export default WebSocketService;

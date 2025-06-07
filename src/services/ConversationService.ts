import { PostgreSQLService } from './PostgreSQLService';
import axios from 'axios';
import { config } from '../config';
import { EventEmitter } from 'events';

export interface ConversationData {
    id?: number;
    phone_number: string;
    customer_name?: string;
    status: 'active' | 'closed' | 'pending' | 'transferred';
    assigned_agent_id?: number;
    metadata?: any;
    created_at?: Date;
    updated_at?: Date;
    last_message_at?: Date;
}

export interface MessageData {
    id?: number;
    conversation_id: number;
    message_id?: string;
    from_number: string;
    to_number: string;
    message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'interactive';
    content?: string;
    media_url?: string;
    media_caption?: string;
    is_from_bot: boolean;
    is_from_customer: boolean;
    timestamp: Date;
    metadata?: any;
}

export class ConversationService extends EventEmitter {
    private static instance: ConversationService;
    private db: PostgreSQLService;

    private constructor() {
        super();
        this.db = PostgreSQLService.getInstance();
    }

    public static getInstance(): ConversationService {
        if (!ConversationService.instance) {
            ConversationService.instance = new ConversationService();
        }
        return ConversationService.instance;
    }

    // Obtener o crear conversación
    public async getOrCreateConversation(phoneNumber: string, customerName?: string): Promise<ConversationData> {
        try {
            // Buscar conversación existente activa
            const existingResult = await this.db.query(
                'SELECT * FROM conversations WHERE phone_number = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
                [phoneNumber, 'active']
            );

            if (existingResult.rows.length > 0) {
                return existingResult.rows[0];
            }

            // Crear nueva conversación
            const insertResult = await this.db.query(
                `INSERT INTO conversations (phone_number, customer_name, status, metadata) 
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [phoneNumber, customerName || null, 'active', JSON.stringify({})]
            );

            const newConversation = insertResult.rows[0];
            this.emit('conversationCreated', newConversation);

            return newConversation;
        } catch (error) {
            console.error('Error obteniendo/creando conversación:', error);
            throw error;
        }
    }

    // Guardar mensaje en la base de datos
    public async saveMessage(messageData: MessageData): Promise<MessageData> {
        try {
            const result = await this.db.query(
                `INSERT INTO messages (conversation_id, message_id, from_number, to_number, 
                 message_type, content, media_url, media_caption, is_from_bot, is_from_customer, 
                 timestamp, metadata) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [
                    messageData.conversation_id,
                    messageData.message_id,
                    messageData.from_number,
                    messageData.to_number,
                    messageData.message_type,
                    messageData.content,
                    messageData.media_url,
                    messageData.media_caption,
                    messageData.is_from_bot,
                    messageData.is_from_customer,
                    messageData.timestamp,
                    JSON.stringify(messageData.metadata || {})
                ]
            );

            // Actualizar última actividad de la conversación
            await this.db.query(
                'UPDATE conversations SET last_message_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [messageData.timestamp, messageData.conversation_id]
            );

            const savedMessage = result.rows[0];
            this.emit('messageReceived', savedMessage);

            return savedMessage;
        } catch (error) {
            console.error('Error guardando mensaje:', error);
            throw error;
        }
    }

    // Obtener conversaciones activas
    public async getActiveConversations(limit: number = 50, offset: number = 0): Promise<ConversationData[]> {
        try {
            const result = await this.db.query(
                `SELECT c.*, cu.username as agent_name,
                        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message
                 FROM conversations c
                 LEFT JOIN crm_users cu ON c.assigned_agent_id = cu.id
                 WHERE c.status = 'active'
                 ORDER BY c.last_message_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );
            return result.rows;
        } catch (error) {
            console.error('Error obteniendo conversaciones activas:', error);
            throw error;
        }
    }

    // Obtener mensajes de una conversación
    public async getConversationMessages(conversationId: number, limit: number = 100): Promise<MessageData[]> {
        try {
            const result = await this.db.query(
                `SELECT * FROM messages WHERE conversation_id = $1 
                 ORDER BY timestamp DESC LIMIT $2`,
                [conversationId, limit]
            );
            return result.rows.reverse(); // Devolver en orden cronológico
        } catch (error) {
            console.error('Error obteniendo mensajes de conversación:', error);
            throw error;
        }
    }

    // Asignar agente a conversación
    public async assignAgent(conversationId: number, agentId: number): Promise<boolean> {
        try {
            const result = await this.db.query(
                'UPDATE conversations SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [agentId, conversationId]
            );

            if (result.rowCount && result.rowCount > 0) {
                this.emit('agentAssigned', { conversationId, agentId });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error asignando agente:', error);
            throw error;
        }
    }

    // Cambiar estado de conversación
    public async updateConversationStatus(conversationId: number, status: string): Promise<boolean> {
        try {
            const result = await this.db.query(
                'UPDATE conversations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [status, conversationId]
            );

            if (result.rowCount && result.rowCount > 0) {
                this.emit('statusChanged', { conversationId, status });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error actualizando estado de conversación:', error);
            throw error;
        }
    }

    // Enviar mensaje a través de Meta API
    public async sendMessage(phoneNumber: string, message: string, messageType: string = 'text'): Promise<boolean> {
        try {
            const url = `https://graph.facebook.com/v18.0/${config.PHONE_NUMBER_ID}/messages`;

            const payload = {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: messageType,
                text: messageType === 'text' ? { body: message } : undefined
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${config.META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                // Guardar mensaje enviado en la base de datos
                const conversation = await this.getOrCreateConversation(phoneNumber);
                await this.saveMessage({
                    conversation_id: conversation.id!,
                    message_id: response.data.messages?.[0]?.id,
                    from_number: config.PHONE_NUMBER_ID,
                    to_number: phoneNumber,
                    message_type: messageType as any,
                    content: message,
                    is_from_bot: true,
                    is_from_customer: false,
                    timestamp: new Date()
                });

                return true;
            }
            return false;
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            return false;
        }
    }

    // Sincronizar mensajes desde Meta API (para historial)
    public async syncMessagesFromMeta(): Promise<void> {
        try {
            // Esta función se puede usar para sincronizar mensajes históricos
            // desde la Meta API si es necesario
            console.log('Sincronizando mensajes desde Meta API...');

            // Implementar lógica de sincronización aquí si Meta proporciona
            // endpoints para obtener historial de mensajes

        } catch (error) {
            console.error('Error sincronizando mensajes:', error);
        }
    }

    // Obtener estadísticas de conversaciones
    public async getConversationStats(): Promise<any> {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'active') as active_conversations,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_conversations,
                    COUNT(*) FILTER (WHERE status = 'closed') as closed_conversations,
                    COUNT(*) FILTER (WHERE assigned_agent_id IS NULL) as unassigned_conversations,
                    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_conversation_duration
                FROM conversations 
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            `);

            return result.rows[0];
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            throw error;
        }
    }
}

export default ConversationService;

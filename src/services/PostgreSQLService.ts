import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';

export class PostgreSQLService {
    private static instance: PostgreSQLService;
    private pool: Pool;

    private constructor() {
        this.pool = new Pool({
            host: config.DB_HOST,
            port: config.DB_PORT,
            database: config.DB_NAME,
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            ssl: config.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            max: config.DB_MAX_CONNECTIONS || 20,
            idleTimeoutMillis: config.DB_IDLE_TIMEOUT || 30000,
            connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT || 2000,
        });

        this.pool.on('error', (err) => {
            console.error('Error de conexión PostgreSQL:', err);
        });

        this.pool.on('connect', () => {
            console.log('Conectado a PostgreSQL');
        });
    }

    public static getInstance(): PostgreSQLService {
        if (!PostgreSQLService.instance) {
            PostgreSQLService.instance = new PostgreSQLService();
        }
        return PostgreSQLService.instance;
    }

    public async query(text: string, params?: any[]): Promise<QueryResult> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } finally {
            client.release();
        }
    }

    public async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }

    public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
    }

    // Métodos específicos para el CRM
    public async initializeTables(): Promise<void> {
        const queries = [
            // Tabla de usuarios del CRM
            `CREATE TABLE IF NOT EXISTS crm_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabla de conversaciones
            `CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                customer_name VARCHAR(100),
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending', 'transferred')),
                assigned_agent_id INTEGER REFERENCES crm_users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            )`,

            // Tabla de mensajes
            `CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                message_id VARCHAR(100) UNIQUE,
                from_number VARCHAR(20) NOT NULL,
                to_number VARCHAR(20) NOT NULL,
                message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'interactive')),
                content TEXT,
                media_url VARCHAR(500),
                media_caption TEXT,
                is_from_bot BOOLEAN DEFAULT false,
                is_from_customer BOOLEAN DEFAULT true,
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            )`,

            // Tabla de tickets/casos
            `CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id),
                ticket_number VARCHAR(50) UNIQUE NOT NULL,
                subject VARCHAR(200) NOT NULL,
                description TEXT,
                priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
                category VARCHAR(50),
                assigned_agent_id INTEGER REFERENCES crm_users(id),
                created_by INTEGER REFERENCES crm_users(id),
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabla de notas de conversación
            `CREATE TABLE IF NOT EXISTS conversation_notes (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                agent_id INTEGER REFERENCES crm_users(id),
                note TEXT NOT NULL,
                is_private BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabla de tags/etiquetas
            `CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                color VARCHAR(7) DEFAULT '#007bff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabla de relación conversación-tags
            `CREATE TABLE IF NOT EXISTS conversation_tags (
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (conversation_id, tag_id)
            )`,

            // Tabla de métricas y estadísticas
            `CREATE TABLE IF NOT EXISTS agent_metrics (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER REFERENCES crm_users(id),
                date DATE NOT NULL,
                conversations_handled INTEGER DEFAULT 0,
                messages_sent INTEGER DEFAULT 0,
                tickets_resolved INTEGER DEFAULT 0,
                avg_response_time_seconds INTEGER DEFAULT 0,
                customer_satisfaction_score DECIMAL(3,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(agent_id, date)
            )`,

            // Índices para mejorar performance
            `CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number)`,
            `CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`,
            `CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id)`,
            `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
            `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`,
            `CREATE INDEX IF NOT EXISTS idx_tickets_agent ON tickets(assigned_agent_id)`,

            // Función para actualizar timestamp
            `CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'`,

            // Triggers para auto-actualizar updated_at
            `CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
            `CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
            `CREATE TRIGGER update_crm_users_updated_at BEFORE UPDATE ON crm_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
        ];

        for (const query of queries) {
            try {
                await this.query(query);
                console.log('Tabla/índice creado exitosamente');
            } catch (error) {
                console.error('Error creando tabla:', error);
            }
        }
    }
}

export default PostgreSQLService;

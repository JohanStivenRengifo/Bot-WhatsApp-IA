const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'bot_user',
    password: process.env.DB_PASSWORD || 'bot_password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

async function setupDatabase() {
    let pool;

    try {
        console.log('🔧 Configurando base de datos PostgreSQL...');

        // Primero conectar sin especificar base de datos para crearla
        const adminPool = new Pool({
            ...dbConfig,
            database: 'postgres' // Base de datos por defecto
        });

        // Crear base de datos si no existe
        const dbName = process.env.DB_NAME || 'whatsapp_bot';

        try {
            await adminPool.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Base de datos '${dbName}' creada exitosamente`);
        } catch (error) {
            if (error.code === '42P04') {
                console.log(`ℹ️  Base de datos '${dbName}' ya existe`);
            } else {
                throw error;
            }
        }

        await adminPool.end();

        // Ahora conectar a la base de datos específica
        pool = new Pool({
            ...dbConfig,
            database: dbName
        });

        console.log('📊 Creando tablas...');

        // Ejecutar script de creación de tablas
        const createTablesScript = `
            -- Tabla de usuarios del CRM
            CREATE TABLE IF NOT EXISTS crm_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Tabla de conversaciones
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                customer_name VARCHAR(100),
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending', 'transferred')),
                assigned_agent_id INTEGER REFERENCES crm_users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            );

            -- Tabla de mensajes
            CREATE TABLE IF NOT EXISTS messages (
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
            );

            -- Tabla de tickets/casos
            CREATE TABLE IF NOT EXISTS tickets (
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
            );

            -- Tabla de notas de conversación
            CREATE TABLE IF NOT EXISTS conversation_notes (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                agent_id INTEGER REFERENCES crm_users(id),
                note TEXT NOT NULL,
                is_private BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Tabla de tags/etiquetas
            CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                color VARCHAR(7) DEFAULT '#007bff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Tabla de relación conversación-tags
            CREATE TABLE IF NOT EXISTS conversation_tags (
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (conversation_id, tag_id)
            );

            -- Tabla de métricas y estadísticas
            CREATE TABLE IF NOT EXISTS agent_metrics (
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
            );
        `;

        await pool.query(createTablesScript);
        console.log('✅ Tablas creadas exitosamente');

        // Crear índices
        console.log('📈 Creando índices...');
        const createIndexesScript = `
            CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
            CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
            CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id);
            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
            CREATE INDEX IF NOT EXISTS idx_tickets_agent ON tickets(assigned_agent_id);
        `;

        await pool.query(createIndexesScript);
        console.log('✅ Índices creados exitosamente');

        // Crear función para actualizar timestamp
        console.log('⚙️  Creando funciones y triggers...');
        const createFunctionsScript = `
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `;

        await pool.query(createFunctionsScript);

        // Crear triggers
        const createTriggersScript = `
            DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
            CREATE TRIGGER update_conversations_updated_at 
                BEFORE UPDATE ON conversations 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

            DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
            CREATE TRIGGER update_tickets_updated_at 
                BEFORE UPDATE ON tickets 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

            DROP TRIGGER IF EXISTS update_crm_users_updated_at ON crm_users;
            CREATE TRIGGER update_crm_users_updated_at 
                BEFORE UPDATE ON crm_users 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `;

        await pool.query(createTriggersScript);
        console.log('✅ Funciones y triggers creados exitosamente');

        // Crear usuario administrador por defecto
        console.log('👤 Creando usuario administrador por defecto...');
        const bcrypt = require('bcryptjs');
        const adminPasswordHash = await bcrypt.hash('admin123', 12);

        try {
            await pool.query(
                `INSERT INTO crm_users (username, email, password_hash, role) 
                 VALUES ($1, $2, $3, $4)`,
                ['admin', 'admin@crm.local', adminPasswordHash, 'admin']
            );
            console.log('✅ Usuario administrador creado: admin/admin123');
        } catch (error) {
            if (error.code === '23505') {
                console.log('ℹ️  Usuario administrador ya existe');
            } else {
                throw error;
            }
        }

        // Crear datos de ejemplo
        console.log('📝 Creando datos de ejemplo...');

        // Tags de ejemplo
        const tags = [
            ['Soporte Técnico', '#ff6b35'],
            ['Ventas', '#28a745'],
            ['Facturación', '#007bff'],
            ['Reclamo', '#dc3545'],
            ['Consulta General', '#6c757d']
        ];

        for (const [name, color] of tags) {
            try {
                await pool.query(
                    'INSERT INTO tags (name, color) VALUES ($1, $2)',
                    [name, color]
                );
            } catch (error) {
                if (error.code !== '23505') { // Ignorar duplicados
                    console.error('Error creando tag:', error);
                }
            }
        }

        console.log('✅ Datos de ejemplo creados');

        console.log(`
🎉 Base de datos configurada exitosamente!

📊 Base de datos: ${dbName}
🏠 Host: ${dbConfig.host}:${dbConfig.port}
👤 Usuario administrador: admin
🔑 Contraseña: admin123

Para iniciar el CRM ejecuta:
npm run crm:dev

Para conectarte a la base de datos:
psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbName}
        `);

    } catch (error) {
        console.error('❌ Error configurando base de datos:', error);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

// Ejecutar configuración
setupDatabase();

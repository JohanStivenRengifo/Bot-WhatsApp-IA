-- Create tables for Bot-Meta application

-- Users table for authentication and tracking
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(256),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table for CRM information
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    email VARCHAR(120),
    address VARCHAR(200),
    service_plan VARCHAR(50),
    account_number VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP
);

-- Tickets table for support issues
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    created_by_id INTEGER REFERENCES users(id),
    issue_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Ticket notes for tracking conversation and updates
CREATE TABLE ticket_notes (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments for scheduling technician visits
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    ticket_id INTEGER REFERENCES tickets(id),
    created_by_id INTEGER REFERENCES users(id),
    technician_name VARCHAR(100),
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled'))
);

-- Conversations for WhatsApp chat history
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) NOT NULL,
    session_id VARCHAR(50) UNIQUE NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    CONSTRAINT valid_status CHECK (status IN ('active', 'ended'))
);

-- Messages for individual WhatsApp messages
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) NOT NULL,
    message_id VARCHAR(50) UNIQUE NOT NULL,
    direction VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    media_url VARCHAR(255),
    media_type VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sentiment_score FLOAT,
    intent_classification VARCHAR(50),
    CONSTRAINT valid_direction CHECK (direction IN ('incoming', 'outgoing'))
);

-- Settings table for application configuration
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    whatsapp_api_token VARCHAR(255),
    whatsapp_phone_number_id VARCHAR(255),
    whatsapp_webhook_verify_token VARCHAR(255),
    gemini_api_key VARCHAR(255),
    gemini_model VARCHAR(255),
    database_url VARCHAR(255),
    notifications_email_alerts BOOLEAN DEFAULT FALSE,
    notifications_email_recipients VARCHAR(255),
    crm_api_url VARCHAR(255),
    crm_api_key VARCHAR(255),
    session_secret VARCHAR(255) DEFAULT 'bot-meta-secret-key'
);

-- Create indexes for better query performance
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
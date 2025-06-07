-- Script de inicialización de la base de datos PostgreSQL para WhatsApp CRM
-- Este script se ejecuta automáticamente cuando se crea el contenedor

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Configuración de timezone
SET timezone = 'America/Bogota';

-- Comentario de información
COMMENT ON DATABASE whatsapp_bot IS 'Base de datos para WhatsApp CRM Bot - Sistema de gestión de conversaciones en tiempo real';

#!/bin/bash
# filepath: c:\Apps\Bot-Meta-AI\scripts\start-production.sh

echo "🚀 Iniciando sistema completo en modo producción..."

# Verificar si las variables de entorno están configuradas
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Advertencia: DATABASE_URL no está configurada"
fi

if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  Advertencia: JWT_SECRET no está configurada"
fi

# Construir el proyecto
echo "📦 Construyendo backend..."
npm run build

echo "📦 Construyendo CRM backend..."
npm run crm:build

echo "📦 Construyendo frontend..."
npm run frontend:build

# Verificar que los archivos compilados existen
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: Bot principal no compilado"
    exit 1
fi

if [ ! -f "dist/crm/start-crm.js" ]; then
    echo "❌ Error: CRM no compilado"
    exit 1
fi

if [ ! -d "crm-turbo-frontend/.next" ]; then
    echo "❌ Error: Frontend no compilado"
    exit 1
fi

echo "✅ Construcción completada"

# Iniciar todos los servicios
echo "🚀 Iniciando servicios..."
npm run start:all

#!/bin/bash

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

# Instalar dependencias de producción
echo "📦 Instalando dependencias..."
npm ci --production

# Verificar configuración
echo "🔍 Verificando configuración..."
if [ ! -f ".env" ]; then
    echo "❌ Error: Archivo .env no encontrado"
    exit 1
fi

# Regenerar tokens si es necesario
echo "🔑 Verificando tokens..."
node -e "require('./utils/tokenManager').refreshToken()"

# Reiniciar la aplicación con PM2
echo "🔄 Reiniciando aplicación..."
pm2 restart bot-meta || pm2 start ecosystem.config.js

# Configurar el webhook de GitHub si está habilitado
if [ ! -z "$GITHUB_WEBHOOK_SECRET" ]; then
    echo "🔗 Configurando webhook de GitHub..."
    curl -X POST -H "Content-Type: application/json" \
         -d "{\"url\": \"$WEBHOOK_URL/update/github\", \"events\": [\"push\"], \"secret\": \"$GITHUB_WEBHOOK_SECRET\"}" \
         -H "Authorization: token $GITHUB_TOKEN" \
         https://api.github.com/repos/user/repo/hooks
fi

echo "✅ Despliegue completado exitosamente"

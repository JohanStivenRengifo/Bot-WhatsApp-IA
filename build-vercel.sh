#!/bin/bash

# Script de build para Vercel
echo "🚀 Iniciando build para Vercel..."

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
npm install

# Build del backend
echo "🔧 Compilando backend..."
npm run build:backend

# Verificar que el build del backend fue exitoso
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: El build del backend falló"
    exit 1
fi

# Navegar al directorio del frontend
echo "📱 Preparando frontend..."
cd crm-dashboard

# Instalar dependencias del frontend
echo "📦 Instalando dependencias del frontend..."
npm install

# Build del frontend
echo "🔧 Compilando frontend..."
npm run build:vercel

# Verificar que el build del frontend fue exitoso
if [ ! -d "dist" ]; then
    echo "❌ Error: El build del frontend falló"
    exit 1
fi

echo "✅ Build completado exitosamente!"
echo "📂 Backend compilado en: dist/"
echo "📂 Frontend compilado en: crm-dashboard/dist/"

# Volver al directorio raíz
cd ..

echo "🎉 Proyecto listo para despliegue en Vercel!"

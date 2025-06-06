#!/bin/bash
# filepath: c:\Apps\Bot-Meta-AI\scripts\invoice-scheduler.sh

# Script para programar la sincronización automática de facturas cada 15 días
# Uso: ./scripts/invoice-scheduler.sh

echo "🕒 Configurando programador de sincronización de facturas..."

# Función para ejecutar sincronización
sync_invoices() {
    echo "⏰ $(date): Ejecutando sincronización programada de facturas..."
    cd "$(dirname "$0")/.."
    npm run sync-invoices
    echo "✅ $(date): Sincronización completada"
}

# Función para verificar si necesitamos sincronizar
check_sync_needed() {
    local cache_file="invoices_cache.json"
    local current_time=$(date +%s)
    local fifteen_days_ago=$((current_time - 15 * 24 * 60 * 60))
    
    if [[ ! -f "$cache_file" ]]; then
        echo "📋 Archivo de caché no existe, ejecutando sincronización inicial..."
        sync_invoices
        return
    fi
    
    local last_sync=$(jq -r '.lastFullSync' "$cache_file" 2>/dev/null || echo "")
    if [[ -z "$last_sync" || "$last_sync" == "null" ]]; then
        echo "📋 No hay sincronización previa, ejecutando sincronización inicial..."
        sync_invoices
        return
    fi
    
    local last_sync_timestamp=$(date -d "$last_sync" +%s 2>/dev/null || echo "0")
    
    if [[ $last_sync_timestamp -lt $fifteen_days_ago ]]; then
        echo "📅 Han pasado más de 15 días desde la última sincronización"
        sync_invoices
    else
        echo "✅ Caché actualizado - última sincronización: $last_sync"
    fi
}

# Configurar como servicio para ejecutar cada hora y verificar si es necesario sincronizar
if [[ "$1" == "install" ]]; then
    echo "📦 Instalando servicio de sincronización automática..."
    
    # Crear script de verificación horaria
    cat > "/tmp/check-invoice-sync.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/../Apps/Bot-Meta-AI"
./scripts/invoice-scheduler.sh check
EOF
    
    chmod +x "/tmp/check-invoice-sync.sh"
    echo "✅ Servicio instalado. El sistema verificará cada hora si necesita sincronizar."
    echo "💡 Para ejecutar manualmente: npm run sync-invoices"
    
elif [[ "$1" == "check" ]]; then
    check_sync_needed
    
elif [[ "$1" == "now" ]]; then
    echo "🚀 Ejecutando sincronización inmediata..."
    sync_invoices
    
else
    echo "📖 Uso del programador de sincronización de facturas:"
    echo ""
    echo "  ./scripts/invoice-scheduler.sh install  - Instalar verificación automática"
    echo "  ./scripts/invoice-scheduler.sh check    - Verificar si necesita sincronizar"
    echo "  ./scripts/invoice-scheduler.sh now      - Sincronizar ahora"
    echo ""
    echo "📋 Comandos NPM disponibles:"
    echo "  npm run sync-invoices        - Sincronizar facturas"
    echo "  npm run sync-invoices:force  - Forzar sincronización completa"
    echo ""
fi

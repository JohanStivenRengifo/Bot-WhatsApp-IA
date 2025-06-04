# 🚀 Configuración de Desarrollo - Bot WhatsApp Dual

## 📋 Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Puerto del servidor
PORT=3000

# WhatsApp Business API
WHATSAPP_TOKEN=tu_token_de_whatsapp
WHATSAPP_VERIFY_TOKEN=tu_verify_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id

# WispHub API
WISPHUB_API_URL=https://api.wisphub.app/api
WISPHUB_API_KEY=tu_api_key_wisphub

# Servicios de IA
OPENAI_API_KEY=tu_openai_api_key
GEMINI_API_KEY=tu_gemini_api_key

# Base de datos local
DATABASE_PATH=./data/bot_cache.db

# Configuración de sesiones
SESSION_TIMEOUT_MINUTES=10
SESSION_WARNING_MINUTES=15

# URLs de servicios
PAYMENT_PORTAL_URL=https://clientes.portalinternet.app/saldo/conecta2tel/
PRIVACY_POLICY_URL=https://conecta2telecomunicaciones.com/legal/politica-de-privacidad

# Configuración de logs
LOG_LEVEL=info
LOG_FILE=./logs/bot.log
```

## 🔧 Scripts de Desarrollo

### Instalar dependencias:
```bash
npm install
```

### Ejecutar en modo desarrollo:
```bash
npm run dev
```

### Compilar proyecto:
```bash
npm run build
```

### Ejecutar tests:
```bash
npm test
```

### Linting y formateo:
```bash
npm run lint
npm run format
```

## 🧪 Modo de Pruebas Locales

### 1. Configurar Webhook Local con ngrok:
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto local
ngrok http 3000

# URL resultante: https://abc123.ngrok.io
```

### 2. Configurar Webhook en WhatsApp:
```bash
# POST a WhatsApp API
curl -X POST "https://graph.facebook.com/v17.0/{phone_number_id}/webhooks" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/webhook",
    "verify_token": "tu_verify_token"
  }'
```

### 3. Datos de Prueba en Base de Datos Local:

Ejecuta este script para poblar la base de datos con datos de prueba:

```sql
-- Clientes de prueba
INSERT INTO customers (document, name, phone, services, status) VALUES
('1048067755', 'Juan Pérez', '+573001234567', '[{"id": 1, "type": "internet", "plan": "50 Mbps", "status": "active"}]', 'active'),
('1234567890', 'María García', '+573007654321', '[{"id": 2, "type": "internet", "plan": "100 Mbps", "status": "active"}, {"id": 3, "type": "tv", "plan": "Premium", "status": "active"}]', 'active'),
('9876543210', 'Carlos López', '+573009876543', '[{"id": 4, "type": "internet", "plan": "30 Mbps", "status": "suspended"}]', 'suspended');

-- Facturas de prueba
INSERT INTO invoices (customer_id, invoice_number, amount, status, due_date, issue_date) VALUES
(1, 'FAC-001234', 85000, 'pending', '2025-06-15', '2025-05-15'),
(1, 'FAC-001233', 85000, 'paid', '2025-05-15', '2025-04-15'),
(2, 'FAC-001235', 125000, 'pending', '2025-06-20', '2025-05-20');
```

## 🎯 Endpoints de Prueba

### Health Check:
```bash
curl http://localhost:3000/health
```

### Webhook Verification:
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=tu_verify_token"
```

### Simulación de Mensaje:
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "573001234567",
            "id": "msg_test_001",
            "timestamp": "1640995200",
            "type": "text",
            "text": {
              "body": "Hola"
            }
          }]
        }
      }]
    }]
  }'
```

## 🔍 Debugging y Monitoreo

### 1. Logs en Tiempo Real:
```bash
tail -f ./logs/bot.log
```

### 2. Debug de Flujos:
```javascript
// Activar debug en MessageHandler
const DEBUG_FLOWS = true;

// Ver estado de sesiones
console.log('Active sessions:', this.userSessions.size);
console.log('Active users:', this.users.size);
```

### 3. Inspección de Base de Datos:
```bash
# Conectar a SQLite
sqlite3 ./data/bot_cache.db

# Ver tablas
.tables

# Ver sessions activas
SELECT * FROM sessions WHERE expires_at > datetime('now');

# Ver cache de facturas
SELECT * FROM invoice_cache ORDER BY created_at DESC LIMIT 10;
```

## 🧪 Tests Automatizados

### Estructura de Tests:
```
src/__tests__/
├── flows/
│   ├── SalesFlow.test.ts
│   ├── AuthenticationFlow.test.ts
│   └── TechnicalSupportFlow.test.ts
├── services/
│   ├── AIService.test.ts
│   ├── MessageService.test.ts
│   └── WispHubService.test.ts
└── integration/
    ├── webhook.test.ts
    └── end-to-end.test.ts
```

### Ejecutar Tests por Categoría:
```bash
# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Tests E2E
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🚀 Deploy y Producción

### 1. Build para Producción:
```bash
npm run build:prod
```

### 2. Variables de Entorno Producción:
```env
NODE_ENV=production
PORT=8080
LOG_LEVEL=warn
DATABASE_PATH=/app/data/bot_cache.db
```

### 3. Docker (Opcional):
```bash
# Build imagen
docker build -t bot-whatsapp-dual .

# Ejecutar contenedor
docker run -p 8080:8080 \
  --env-file .env.production \
  -v /host/data:/app/data \
  bot-whatsapp-dual
```

## 📊 Monitoreo en Producción

### Métricas Importantes:
- Número de conversaciones activas
- Tiempo de respuesta promedio
- Tasa de errores por flujo
- Uso de memoria y CPU
- Latencia de APIs externas

### Alertas Configuradas:
- Sesiones > 1000 usuarios simultáneos
- Tiempo de respuesta > 3 segundos
- Errores > 5% en 5 minutos
- API WispHub no disponible
- Espacio en disco < 10%

## 🔧 Troubleshooting Común

### Problema: Bot no responde
```bash
# Verificar webhook
curl -I https://tu-dominio.com/webhook

# Verificar logs
tail -f ./logs/bot.log | grep ERROR

# Reiniciar servicio
pm2 restart bot-whatsapp
```

### Problema: Autenticación falla
```bash
# Verificar API WispHub
curl -H "Authorization: Api-Key $WISPHUB_API_KEY" \
  https://api.wisphub.app/api/clientes/1048067755/

# Verificar token WhatsApp
curl -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  https://graph.facebook.com/v17.0/me
```

### Problema: Base de datos corrupta
```bash
# Backup
cp ./data/bot_cache.db ./data/bot_cache.db.backup

# Reparar
sqlite3 ./data/bot_cache.db ".backup main backup.db"
mv backup.db ./data/bot_cache.db
```

---

**✅ Estado**: Configuración completa para desarrollo y producción
**📅 Actualizado**: Junio 2025
**🔧 Mantenimiento**: Revisión mensual recomendada

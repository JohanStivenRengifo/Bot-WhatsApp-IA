# 🌐 Bot WhatsApp Conecta2 Telecomunicaciones

Bot inteligente de WhatsApp para atención al cliente de Conecta2 Telecomunicaciones SAS, desarrollado con TypeScript e integrado con Meta API, WispHub y CRM.

## 🚀 Características Principales

### ✅ Funcionalidades Implementadas

- **Aceptación de Políticas de Privacidad** - Cumplimiento GDPR/Ley 1581 de 2012
- **Ping a IP (Mikrotik)** - Verificación de conectividad en tiempo real
- **Consulta y Envío de Facturas** - Gestión completa de facturación
- **Notificaciones Automáticas** - Alertas por corte o vencimiento
- **Creación de Tickets** - Integración directa con CRM
- **Soporte en Línea** - Envío de documentos y comprobantes
- **Cambio de Contraseña** - Autogestión de credenciales
- **Consulta de Deuda** - Estado de cuenta en tiempo real
- **Ubicación de Puntos de Pago** - Información geolocalizada
- **Mejora de Plan** - Proceso automatizado de upgrade
- **IA Conversacional** - Respuestas inteligentes con OpenAI

### 🔧 Integraciones

- **Meta WhatsApp Business API** - Comunicación bidireccional
- **WispHub API** - Gestión de servicios ISP
- **CRM Integration** - Ticketing y seguimiento
- **Mikrotik RouterOS** - Diagnósticos de red
- **OpenAI GPT** - Procesamiento de lenguaje natural
- **PostgreSQL** - Base de datos robusta

## 📋 Requisitos del Sistema

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 12
- **Docker** (opcional)
- **SSL Certificate** (producción)

## 🛠️ Instalación

### Método 1: Instalación Manual

```bash
# Clonar repositorio
git clone https://github.com/conecta2/whatsapp-bot.git
cd whatsapp-bot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Construir aplicación
npm run build

# Iniciar base de datos
psql -U postgres -c "CREATE DATABASE conecta2_bot;"

# Ejecutar migraciones
npm run migrate

# Iniciar aplicación
npm start
```

### Método 2: Docker Compose (Recomendado)

```bash
# Clonar repositorio
git clone https://github.com/conecta2/whatsapp-bot.git
cd whatsapp-bot

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Levantar todos los servicios
docker-compose up -d

# Verificar estado
docker-compose ps
```

## ⚙️ Configuración

### 1. Meta WhatsApp Business API

1. Crear aplicación en [Meta for Developers](https://developers.facebook.com/)
2. Configurar WhatsApp Business API
3. Obtener tokens y phone number ID
4. Configurar webhook URL: `https://tu-dominio.com/webhook`

### 2. Variables de Entorno

```bash
# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=tu_token_permanente
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_WEBHOOK_VERIFY_TOKEN=token_verificacion_seguro
META_APP_SECRET=secret_de_tu_app

# Base de Datos
DB_HOST=localhost
DB_NAME=conecta2_bot
DB_USER=conecta2
DB_PASSWORD=password_seguro

# APIs Externas
WISPHUB_API_KEY=tu_wisphub_key
CRM_API_KEY=tu_crm_key
OPENAI_API_KEY=sk-tu_openai_key

# Mikrotik
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=mikrotik_password
```

### 3. Configuración del Webhook

En Meta for Developers:
- **Webhook URL**: `https://tu-dominio.com/webhook`
- **Verify Token**: El mismo que configuraste en `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- **Campos**: `messages`

## 🎯 Uso del Bot

### Flujo de Conversación

1. **Bienvenida y Privacidad**
   ```
   Usuario: Hola
   Bot: Bienvenido a Conecta2. ¿Aceptas el tratamiento de datos?
   Usuario: Acepto
   Bot: [Muestra menú principal]
   ```

2. **Menú Principal**
   - 📡 Verificar Conexión
   - 📄 Consultar Factura
   - 💰 Consultar Deuda
   - 🔒 Cambiar Contraseña
   - 🎫 Crear Ticket
   - ⬆️ Mejorar Plan
   - 👨‍💼 Hablar con Agente

3. **Respuestas Inteligentes**
   ```
   Usuario: Mi internet está lento
   Bot: Te ayudo a diagnosticar. ¿Quieres que verifique tu conexión?
   [Ejecuta ping automáticamente]
   ```

### Comandos Especiales

- `menu` - Mostrar menú principal
- `ayuda` - Obtener ayuda
- `agente` - Solicitar soporte humano
- `facturas` - Ver facturas pendientes
- `deuda` - Consultar saldo
- `puntos de pago` - Ubicaciones de pago

## 🔧 API Endpoints

### Webhook Principal
```http
POST /webhook
Content-Type: application/json
X-Hub-Signature-256: sha256=signature

# Recibe mensajes de WhatsApp
```

### Salud del Sistema
```http
GET /health
Response: {
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "active_conversations": 25,
  "uptime": 86400
}
```

### Estadísticas
```http
GET /stats
Response: {
  "total_customers": 1500,
  "active_conversations": 25,
  "pending_invoices": 120
}
```

### Notificaciones Manuales
```http
POST /trigger-notifications
# Envía notificaciones pendientes
```

### Broadcast
```http
POST /broadcast
Content-Type: application/json

{
  "message": "Mantenimiento programado esta noche",
  "target_group": "active"
}
```

## 📊 Monitoreo y Logging

### Logs del Sistema
```bash
# Ver logs en tiempo real
docker-compose logs -f whatsapp-bot

# Logs específicos
tail -f logs/conecta2-bot.log
```

### Métricas (Prometheus/Grafana)
- Mensajes procesados por minuto
- Tiempo de respuesta promedio
- Errores por endpoint
- Conversaciones activas
- Estado de integraciones

### Alertas Configuradas
- Caída del servicio
- Alto tiempo de respuesta
- Errores en integraciones
- Uso excesivo de memoria

## 🔒 Seguridad

### Medidas Implementadas

1. **Verificación de Webhook**
   - Validación de firma HMAC
   - Token de verificación seguro

2. **Rate Limiting**
   - 50 requests por minuto por usuario
   - Protección contra spam

3. **Sanitización de Datos**
   - Validación de entrada
   - Escape de caracteres especiales

4. **Encriptación**
   - Datos sensibles encriptados
   - Conexiones HTTPS únicamente

5. **Autenticación de APIs**
   - Tokens JWT para APIs externas
   - Rotación periódica de tokens

## 📈 Performance

### Optimizaciones

- **Conexión a BD con Pool** - Reutilización de conexiones
- **Cache en Redis** - Respuestas frecuentes cacheadas
- **Rate Limiting** - Prevención de sobrecarga
- **Compresión GZIP** - Reducción de ancho de banda
- **CDN para Assets** - Entrega rápida de documentos

### Métricas Objetivo

- **Tiempo de respuesta**: < 2 segundos
- **Disponibilidad**: 99.9%
- **Throughput**: 1000 mensajes/minuto
- **Concurrencia**: 100 conversaciones simultáneas

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm test

# Tests de integración
npm run test:integration

# Coverage
npm run test:coverage

# Tests E2E
npm run test:e2e
```

### Casos de Prueba

1. **Funcionalidades Básicas**
   - Envío y recepción de mensajes
   - Menú interactivo
   - Respuestas de IA

2. **Integraciones**
   - Conexión a WispHub
   - Creación de tickets en CRM
   - Ping a Mikrotik

3. **Flujos Completos**
   - Registro de nuevo cliente
   - Consulta de factura
   - Cambio de contraseña

## 🚨 Troubleshooting

### Problemas Comunes

1. **Bot no responde**
   ```bash
   # Verificar webhook
   curl -X GET "https://tu-dominio.com/health"
   
   # Revisar logs
   docker-compose logs whatsapp-bot
   ```

2. **Error de Base de Datos**
   ```bash
   # Verificar conexión
   docker-compose exec postgres psql -U conecta2 -d conecta2_bot
   
   # Reiniciar servicio
   docker-compose restart postgres
   ```

3. **Timeout en APIs**
   ```bash
   # Verificar conectividad
   curl -v https://api.wisphub.net/v1/health
   
   # Aumentar timeout en config
   ```

### Logs de Error Frecuentes

```log
[ERROR] WhatsApp API Rate Limit Exceeded
Solución: Implementar backoff exponencial

[ERROR] Database Connection Lost
Solución: Verificar pool de conexiones

[ERROR] Mikrotik SSH Timeout
Solución: Revisar configuración de red
```

## 🔄 Actualizaciones

### Proceso de Deploy

```bash
# Backup de base de datos
pg_dump conecta2_bot > backup_$(date +%Y%m%d).sql

# Pull últimos cambios
git pull origin main

# Rebuild y deploy
docker-compose build --no-cache
docker-compose up -d

# Verificar salud
curl https://tu-dominio.com/health
```

### Versionado

- **Major** (1.x.x): Cambios breaking
- **Minor** (x.1.x): Nuevas características
- **Patch** (x.x.1): Bug fixes

## 📞 Soporte

### Canales de Soporte

- **Email**: soporte-bot@conecta2.com
- **WhatsApp**: +57 300 123 4567
- **Slack**: #bot-conecta2
- **Documentación**: https://docs.conecta2.com/bot

### Escalación de Incidentes

1. **Nivel 1** - Desarrollo
2. **Nivel
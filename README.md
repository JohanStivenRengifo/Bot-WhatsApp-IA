# Bot de WhatsApp - Conecta2 Telecomunicaciones

## 📱 Descripción
Bot de WhatsApp para atención al cliente de Conecta2 Telecomunicaciones, con capacidades de soporte técnico, registro de servicios y transferencia a agentes humanos.

## 🚀 Características

- ✅ Flujos de conversación modulares
- 🔄 Integración con Meta API v22.0
- 👥 Transferencia bot/humano
- 📊 Dashboard de métricas
- 🔐 Autenticación automática
- 🔄 Actualización automática desde GitHub

## 🛠️ Tecnologías

- Node.js
- Express
- MongoDB
- Redis (caché)
- PM2 (gestión de procesos)
- Prometheus (métricas)

## ⚙️ Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/usuario/bot-meta.git
cd bot-meta
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. Iniciar el servidor:
```bash
npm start
```

## 🔧 Configuración

### Variables de Entorno

- `PORT`: Puerto del servidor (default: 3008)
- `MONGODB_URI`: URI de conexión a MongoDB
- `META_JWT_TOKEN`: Token de Meta API
- `META_NUMBER_ID`: ID del número de WhatsApp
- `GITHUB_WEBHOOK_SECRET`: Secret para webhooks de GitHub

## 🎯 Uso

### API Endpoints

#### Webhook
- `GET /webhook`: Verificación de webhook de Meta
- `POST /webhook`: Recepción de mensajes de WhatsApp

#### Dashboard
- `GET /dashboard/stats`: Estadísticas generales
- `GET /dashboard/conversations/active`: Conversaciones activas
- `POST /dashboard/conversations/:phoneNumber/handover`: Transferir a humano

#### Actualizaciones
- `POST /update/github`: Webhook para actualizaciones de GitHub

## 📊 Monitoreo

### Métricas disponibles:
- Total de mensajes procesados
- Conversaciones activas
- Tiempo de respuesta
- Transferencias a humanos

Acceso: `/metrics`

## 🔐 Seguridad

- Tokens JWT autogenerados
- Rate limiting por IP
- Validación de webhooks
- Sanitización de inputs

## 🚀 Despliegue

1. Configurar PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

2. Configurar Nginx:
```nginx
server {
    listen 443 ssl;
    server_name bot.example.com;

    location / {
        proxy_pass http://localhost:3008;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📝 Licencia

MIT
# Guía de Inicio Rápido - Conecta2 WhatsApp Bot

Esta guía te ayudará a configurar y ejecutar el bot de WhatsApp de Conecta2 Telecomunicaciones en tu entorno local para desarrollo o en un servidor para producción.

## Requisitos Previos

- Node.js (v14.0.0 o superior)
- npm (v6.0.0 o superior)
- Cuenta de desarrollador de Meta
- Número de teléfono de WhatsApp Business
- Acceso a las APIs de WispHub y CRM
- Clave de API de OpenAI

## Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone https://github.com/conecta2/whatsapp-bot.git
cd whatsapp-bot
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```
# Meta WhatsApp API
META_ACCESS_TOKEN=tu_token_de_acceso
WEBHOOK_VERIFY_TOKEN=tu_token_de_verificacion
PHONE_NUMBER_ID=tu_id_de_telefono

# WispHub API
WISPHUB_API_URL=https://api.wisphub.ejemplo.com
WISPHUB_API_KEY=tu_clave_api_wisphub

# CRM API
CRM_API_URL=https://crm.ejemplo.com/api
CRM_API_KEY=tu_clave_api_crm

# OpenAI API
OPENAI_API_KEY=tu_clave_api_openai

# Server
PORT=3000
```

## Desarrollo Local

### 1. Compilar el Código TypeScript

```bash
npm run build
```

O para desarrollo con recompilación automática:

```bash
npm run dev
```

### 2. Exponer tu Servidor Local

Para que Meta pueda enviar eventos a tu webhook, necesitas exponer tu servidor local a Internet. Puedes usar [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Esto te dará una URL pública (ej: `https://a1b2c3d4.ngrok.io`).

### 3. Configurar Webhook en Meta

1. Ve al [Panel de Desarrolladores de Meta](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. Configura el webhook para WhatsApp:
   - URL: `https://tu-url-ngrok.io/webhook`
   - Token de verificación: El mismo valor que configuraste en `WEBHOOK_VERIFY_TOKEN`
   - Campos de suscripción: `messages`

### 4. Iniciar el Servidor

```bash
npm start
```

## Pruebas

### Verificar Webhook

Accede a `https://tu-url-ngrok.io/health` en tu navegador. Deberías ver:

```json
{"status":"active","service":"Conecta2 WhatsApp Bot"}
```

### Enviar Mensaje de Prueba

Envía un mensaje desde WhatsApp al número de teléfono configurado. El bot debería responder con el mensaje de política de privacidad.

## Despliegue en Producción

### Usando PM2

1. Instala PM2 globalmente:
   ```bash
   npm install -g pm2
   ```

2. Compila el código TypeScript:
   ```bash
   npm run build
   ```

3. Inicia la aplicación con PM2:
   ```bash
   pm2 start dist/index.js --name whatsapp-bot
   ```

4. Configura el inicio automático:
   ```bash
   pm2 startup
   pm2 save
   ```

### Usando Docker

1. Construye la imagen Docker:
   ```bash
   docker build -t conecta2/whatsapp-bot .
   ```

2. Ejecuta el contenedor:
   ```bash
   docker run -d -p 3000:3000 --env-file .env --name whatsapp-bot conecta2/whatsapp-bot
   ```

## Estructura del Proyecto

```
src/
├── config/           # Configuración y variables de entorno
├── controllers/      # Lógica de negocio y manejo de mensajes
├── interfaces/       # Definiciones de tipos TypeScript
├── middlewares/      # Middlewares de Express
├── routes/           # Rutas de la API
├── services/         # Servicios para integraciones externas
├── utils/            # Funciones de utilidad
└── index.ts          # Punto de entrada de la aplicación
```

## Comandos Disponibles

- `npm run build`: Compila el código TypeScript
- `npm run dev`: Ejecuta el servidor en modo desarrollo con recompilación automática
- `npm start`: Inicia el servidor en modo producción
- `npm run lint`: Ejecuta el linter para verificar el código
- `npm test`: Ejecuta las pruebas (si están configuradas)

## Flujo de Desarrollo

1. Realiza cambios en el código
2. Compila con `npm run build`
3. Reinicia el servidor con `npm start` o `pm2 restart whatsapp-bot`
4. Prueba los cambios enviando mensajes al bot

## Solución de Problemas Comunes

### El Webhook no se Verifica

- Verifica que la URL sea accesible públicamente
- Confirma que el token de verificación coincida
- Asegúrate de que la ruta sea exactamente `/webhook`

### Los Mensajes no se Reciben

- Verifica que estés suscrito al evento `messages` en el panel de Meta
- Confirma que el número de teléfono esté correctamente configurado
- Revisa los logs del servidor para errores

### Los Mensajes no se Envían

- Verifica el `META_ACCESS_TOKEN` y `PHONE_NUMBER_ID`
- Confirma que el número de teléfono esté aprobado en WhatsApp Business
- Revisa los logs para errores específicos de la API

## Recursos Adicionales

- [Documentación de la API de WhatsApp Business](https://developers.facebook.com/docs/whatsapp)
- [Documentación Técnica Completa](./TECHNICAL_DOCS.md)
- [README Principal](./README.md)

---

© 2023 Conecta2 Telecomunicaciones SAS. Todos los derechos reservados.
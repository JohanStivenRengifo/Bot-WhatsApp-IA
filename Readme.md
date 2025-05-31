# Conecta2 WhatsApp Bot

## Descripción General

El Conecta2 WhatsApp Bot es una solución de atención al cliente automatizada para Conecta2 Telecomunicaciones SAS, que permite a los usuarios interactuar con la empresa a través de WhatsApp. El bot proporciona una variedad de servicios, desde consultas de facturas hasta soporte técnico, utilizando la API de WhatsApp Business de Meta.

## Características Principales

- **Aceptación de Política de Privacidad**: Solicita y registra el consentimiento del usuario para el tratamiento de datos personales.
- **Autenticación de Usuario**: Verifica la identidad del usuario mediante su número de documento.
- **Diagnóstico de Conexión**: Realiza pruebas de ping a la IP del cliente para verificar el estado de su conexión.
- **Gestión de Facturas**: Consulta y envía facturas, incluyendo documentos PDF.
- **Notificaciones Automáticas**: Alerta sobre vencimientos de facturas y mantenimientos programados.
- **Sistema de Tickets**: Crea y gestiona tickets de soporte técnico integrados con el CRM.
- **Cambio de Contraseña**: Permite a los usuarios actualizar sus credenciales de forma segura.
- **Información de Pagos**: Proporciona detalles sobre deudas pendientes y ubicaciones de puntos de pago.
- **Mejora de Plan**: Muestra opciones disponibles para actualizar el plan de servicio.
- **Respuestas Inteligentes**: Utiliza IA para procesar consultas en lenguaje natural y proporcionar respuestas relevantes.

## Arquitectura del Sistema

El bot está construido con una arquitectura modular que facilita su mantenimiento y escalabilidad:

### Estructura de Directorios

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

### Componentes Principales

1. **WebhookController**: Maneja las solicitudes entrantes de la API de WhatsApp.
2. **MessageHandler**: Procesa los mensajes de los usuarios y coordina las respuestas.
3. **NotificationController**: Gestiona las notificaciones automáticas programadas.
4. **Servicios Especializados**:
   - **MessageService**: Envío de mensajes a través de la API de WhatsApp.
   - **CustomerService**: Interacción con la API de WispHub para datos de clientes.
   - **TicketService**: Gestión de tickets de soporte en el CRM.
   - **PaymentService**: Información sobre pagos y facturas.
   - **AIService**: Integración con OpenAI para respuestas inteligentes.

## Flujo de Trabajo

1. **Inicio de Conversación**:
   - El usuario envía un mensaje al número de WhatsApp de la empresa.
   - El bot verifica si el usuario ha aceptado la política de privacidad.
   - Si es la primera interacción, solicita aceptación de la política.

2. **Autenticación**:
   - Una vez aceptada la política, solicita el número de documento para autenticar.
   - Verifica la identidad del usuario contra la base de datos de WispHub.

3. **Menú Principal**:
   - Después de la autenticación, el usuario puede acceder al menú principal.
   - Desde aquí, puede seleccionar diferentes opciones de servicio.

4. **Servicios Disponibles**:
   - Test de conexión (ping)
   - Consulta de facturas
   - Creación de tickets de soporte
   - Cambio de contraseña
   - Consulta de deuda
   - Información de puntos de pago
   - Mejora de plan

5. **Notificaciones Automáticas**:
   - El sistema verifica periódicamente facturas vencidas y mantenimientos programados.
   - Envía notificaciones proactivas a los usuarios afectados.

## Requisitos Técnicos

- **Node.js**: v14.0.0 o superior
- **TypeScript**: v4.5.0 o superior
- **Express**: Framework web para la API
- **Axios**: Cliente HTTP para integraciones externas
- **Dotenv**: Gestión de variables de entorno
- **Moment.js**: Manipulación de fechas
- **Ping**: Utilidad para pruebas de conectividad

## Integraciones

El bot se integra con tres sistemas externos principales:

1. **Meta WhatsApp Business API**:
   - Envío y recepción de mensajes de WhatsApp
   - Gestión de mensajes interactivos (botones, listas)
   - Envío de documentos y ubicaciones

2. **WispHub API**:
   - Autenticación de clientes
   - Consulta de información de servicio
   - Gestión de facturas y pagos
   - Información de planes y upgrades

3. **CRM API**:
   - Creación y seguimiento de tickets de soporte
   - Notificaciones de actualizaciones de tickets

4. **OpenAI API**:
   - Procesamiento de lenguaje natural
   - Generación de respuestas inteligentes

## Configuración y Despliegue

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

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

### Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/conecta2/whatsapp-bot.git
   cd whatsapp-bot
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Compila el código TypeScript:
   ```bash
   npm run build
   ```

### Ejecución

#### Desarrollo

```bash
npm run dev
```

#### Producción

```bash
npm start
```

### Configuración de Webhook

1. Inicia el servidor en un entorno accesible desde Internet (o utiliza ngrok para desarrollo).
2. Configura el webhook en el panel de desarrolladores de Meta:
   - URL: `https://tu-dominio.com/webhook`
   - Token de verificación: El mismo valor que configuraste en `WEBHOOK_VERIFY_TOKEN`
   - Suscríbete a los eventos de mensajes de WhatsApp.

### Despliegue en Producción

#### Usando PM2

1. Instala PM2 globalmente:
   ```bash
   npm install -g pm2
   ```

2. Inicia la aplicación con PM2:
   ```bash
   pm2 start dist/index.js --name whatsapp-bot
   ```

3. Configura el inicio automático:
   ```bash
   pm2 startup
   pm2 save
   ```

#### Usando Docker

1. Construye la imagen Docker:
   ```bash
   docker build -t conecta2/whatsapp-bot .
   ```

2. Ejecuta el contenedor:
   ```bash
   docker run -d -p 3000:3000 --env-file .env --name whatsapp-bot conecta2/whatsapp-bot
   ```

## Monitoreo y Mantenimiento

### Logs

- Los logs de la aplicación se escriben en la consola estándar.
- Si utilizas PM2, puedes ver los logs con:
  ```bash
  pm2 logs whatsapp-bot
  ```

### Verificación de Estado

- Endpoint de verificación de estado: `GET /health`
- Devuelve información sobre el estado actual del servicio.

## Seguridad

- Todas las comunicaciones utilizan HTTPS.
- Las credenciales de API se almacenan en variables de entorno.
- La autenticación de usuarios se realiza mediante documento de identidad.
- Se requiere aceptación explícita de la política de privacidad.

## Extensibilidad

El diseño modular facilita la adición de nuevas características:

1. Para agregar un nuevo comando:
   - Actualiza el método `handleMainCommands` en `MessageHandler.ts`
   - Implementa el método correspondiente para manejar la lógica

2. Para integrar con un nuevo servicio externo:
   - Crea un nuevo archivo en el directorio `services/`
   - Exporta la clase desde `services/index.ts`
   - Inyecta el servicio donde sea necesario

## Solución de Problemas

### Problemas Comunes

1. **Webhook no se verifica**:
   - Verifica que la URL sea accesible públicamente.
   - Confirma que el token de verificación coincida.
   - Asegúrate de que la ruta sea exactamente `/webhook`.

2. **Mensajes no se envían**:
   - Verifica el `META_ACCESS_TOKEN` y `PHONE_NUMBER_ID`.
   - Confirma que el número de teléfono esté aprobado en WhatsApp Business.
   - Revisa los logs para errores específicos de la API.

3. **Integraciones externas fallan**:
   - Verifica las credenciales de API.
   - Confirma que las URLs de los servicios sean correctas.
   - Revisa la conectividad de red desde el servidor.

## Contacto y Soporte

Para soporte técnico o consultas sobre el bot, contacta a:

- **Equipo de Desarrollo**: desarrollo@conecta2.com
- **Soporte Técnico**: soporte@conecta2.com

---

© 2023 Conecta2 Telecomunicaciones SAS. Todos los derechos reservados.
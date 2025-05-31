# Documentación Técnica - Conecta2 WhatsApp Bot

## Arquitectura Detallada

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        WhatsApp Bot App                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
           ┌───────────────────┼───────────────────┐
           │                    │                   │
┌──────────▼──────────┐ ┌──────▼───────┐ ┌─────────▼──────���──┐
│     Express API      │ │  Controllers │ │ Notification Sys  │
└──────────┬──────────┘ └──────┬───────┘ └─────────┬─────────┘
           │                    │                   │
           └───────────────────┼───────────────────┘
                               │
                     ┌─────────▼─────────┐
                     │      Services      │
                     └─────────┬─────────┘
                               │
     ┌───────────────┬─────────┼─────────┬───────────────┐
     │               │         │         │               │
┌────▼────┐    ┌────▼────┐┌───▼───┐┌────▼────┐    ┌─────▼────┐
│  Meta    │    │ WispHub ││  CRM  ││ OpenAI  │    │ Utilities │
│   API    │    │   API   ││  API  ││   API   │    │           │
└─────────┘    └─────────┘└───────┘└─────────┘    └───────────┘
```

### Flujo de Datos

1. **Recepción de Mensajes**:
   ```
   Meta WhatsApp API → Webhook → WebhookController → MessageHandler → Servicios específicos
   ```

2. **Envío de Mensajes**:
   ```
   MessageHandler → MessageService → Meta WhatsApp API → Usuario
   ```

3. **Notificaciones Automáticas**:
   ```
   NotificationController → CustomerService → MessageService → Meta WhatsApp API → Usuario
   ```

## Componentes del Sistema

### 1. Configuración (`config/index.ts`)

Centraliza todas las configuraciones y variables de entorno:

```typescript
export const config = {
    meta: {
        accessToken: process.env.META_ACCESS_TOKEN || '',
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
        phoneNumberId: process.env.PHONE_NUMBER_ID || '',
        version: 'v18.0'
    },
    wisphub: {
        baseUrl: process.env.WISPHUB_API_URL || '',
        apiKey: process.env.WISPHUB_API_KEY || ''
    },
    crm: {
        baseUrl: process.env.CRM_API_URL || '',
        apiKey: process.env.CRM_API_KEY || ''
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || ''
    },
    server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000
    }
};
```

### 2. Interfaces (`interfaces/`)

Definen los tipos de datos utilizados en la aplicación:

- **User**: Información del usuario de WhatsApp
- **Ticket**: Estructura de tickets de soporte
- **Invoice**: Estructura de facturas

### 3. Controladores (`controllers/`)

#### WebhookController

Maneja las solicitudes HTTP entrantes:

- `verifyWebhook`: Verifica el webhook para Meta
- `handleWebhook`: Procesa los eventos entrantes de WhatsApp
- `healthCheck`: Endpoint para verificar el estado del servicio

#### MessageHandler

Procesa los mensajes de los usuarios:

- `processMessage`: Punto de entrada para el procesamiento de mensajes
- `handleUserMessage`: Dirige el mensaje según el estado del usuario
- `handlePrivacyPolicyFlow`: Gestiona la aceptación de la política de privacidad
- `handleAuthenticationFlow`: Maneja la autenticación del usuario
- `handleMainCommands`: Procesa los comandos principales del menú
- Métodos específicos para cada funcionalidad (ping, facturas, tickets, etc.)

#### NotificationController

Gestiona las notificaciones automáticas:

- `startNotificationSystem`: Inicia los temporizadores para las verificaciones periódicas
- `checkOverdueInvoices`: Verifica facturas vencidas y envía notificaciones
- `checkServiceOutages`: Verifica cortes de servicio programados y notifica a los usuarios afectados

### 4. Servicios (`services/`)

#### MessageService

Gestiona el envío de mensajes a través de la API de WhatsApp:

- `sendMessage`: Método base para enviar cualquier tipo de mensaje
- `sendTextMessage`: Envía mensajes de texto simples
- `sendDocument`: Envía documentos (PDF, etc.)
- `sendLocation`: Envía ubicaciones geográficas
- `sendPrivacyPolicyMessage`: Envía el mensaje de política de privacidad
- `sendMainMenu`: Envía el menú principal interactivo
- `sendPaymentOptions`: Envía opciones de pago interactivas

#### CustomerService

Interactúa con la API de WispHub para gestionar datos de clientes:

- `authenticateCustomer`: Autentica al cliente por número de documento
- `getCustomerInfo`: Obtiene información del cliente
- `pingIP`: Realiza pruebas de ping a la IP del cliente
- `getCustomerInvoices`: Obtiene las facturas del cliente
- `getCustomerDebt`: Obtiene información de deuda
- `getCustomerPlan`: Obtiene el plan actual del cliente
- `getAvailableUpgrades`: Obtiene planes disponibles para upgrade
- `verifyPassword`: Verifica la contraseña del cliente
- `updatePassword`: Actualiza la contraseña del cliente
- `getOverdueCustomers`: Obtiene clientes con facturas vencidas
- `getServiceOutages`: Obtiene información de cortes de servicio programados
- `getAffectedUsers`: Obtiene usuarios afectados por un corte de servicio

#### TicketService

Gestiona tickets de soporte en el CRM:

- `createTicket`: Crea un nuevo ticket de soporte
- `notifyNewTicket`: Notifica al CRM sobre un nuevo ticket
- `getCategoryName`: Convierte IDs de categoría en nombres legibles

#### PaymentService

Gestiona información relacionada con pagos:

- `getPaymentPoints`: Obtiene puntos de pago disponibles
- `getInvoiceStatusText`: Convierte estados de factura en texto legible

#### AIService

Integra con OpenAI para respuestas inteligentes:

- `getAIResponse`: Obtiene una respuesta generada por IA para una consulta

### 5. Utilidades (`utils/`)

Funciones de utilidad reutilizables:

- `isValidPassword`: Valida que una contraseña cumpla con los requisitos de seguridad

### 6. Rutas (`routes/`)

Define las rutas de la API:

- `GET /webhook`: Verificación del webhook de Meta
- `POST /webhook`: Recepción de eventos de WhatsApp
- `GET /health`: Verificación del estado del servicio

## Flujos de Usuario Detallados

### 1. Onboarding de Usuario Nuevo

```
Usuario envía mensaje
↓
Bot verifica si el usuario existe → No existe
↓
Bot envía política de privacidad
↓
Usuario acepta política
↓
Bot solicita documento de identidad
↓
Usuario envía documento
↓
Bot autentica usuario con WispHub
↓
Bot da la bienvenida y muestra menú principal
```

### 2. Consulta de Factura

```
Usuario autenticado solicita factura
↓
Bot consulta facturas en WispHub
↓
Bot envía resumen de factura actual
↓
Bot envía PDF de factura (si está disponible)
↓
Si la factura está pendiente, Bot envía opciones de pago
```

### 3. Test de Conexión (Ping)

```
Usuario solicita test de conexión
↓
Bot obtiene IP del cliente desde WispHub
↓
Bot realiza ping a la IP
↓
Si ping exitoso → Bot informa conexión activa
↓
Si ping fallido → Bot informa problema y crea ticket automático
```

### 4. Creación de Ticket

```
Usuario solicita crear ticket
↓
Bot muestra categorías de problemas
↓
Usuario selecciona categoría
↓
Bot solicita descripción del problema
↓
Usuario envía descripción
↓
Bot crea ticket en CRM
↓
Bot confirma creación y proporciona número de ticket
```

## Manejo de Estados y Sesiones

El bot mantiene el estado de los usuarios a través de dos mapas:

1. **users**: Almacena información persistente del usuario
   ```typescript
   Map<string, User>
   ```

2. **userSessions**: Almacena datos temporales para flujos multi-paso
   ```typescript
   Map<string, any>
   ```

Ejemplos de flujos multi-paso:
- Cambio de contraseña (verificación, nueva contraseña, confirmación)
- Creación de ticket (categor��a, descripción)

## Integración con APIs Externas

### Meta WhatsApp Business API

Endpoints utilizados:
- `POST /{version}/{phone-number-id}/messages`: Envío de mensajes

Tipos de mensajes soportados:
- Texto simple
- Interactivos (botones, listas)
- Documentos (PDF)
- Ubicaciones

### WispHub API

Endpoints utilizados:
- `/customers/search`: Búsqueda de clientes por documento
- `/customers/{id}`: Información del cliente
- `/customers/{id}/invoices`: Facturas del cliente
- `/customers/{id}/debt`: Información de deuda
- `/customers/{id}/plan`: Plan actual del cliente
- `/customers/{id}/upgrade-options`: Opciones de mejora de plan
- `/customers/{id}/verify-password`: Verificación de contraseña
- `/customers/{id}/password`: Actualización de contraseña
- `/customers/overdue`: Clientes con facturas vencidas
- `/outages/scheduled`: Cortes programados
- `/customers/by-area/{area}`: Clientes por área geográfica
- `/payment-points`: Puntos de pago disponibles

### CRM API

Endpoints utilizados:
- `/tickets`: Creación de tickets
- `/tickets/{id}/notifications`: Notificaciones sobre tickets

### OpenAI API

Endpoints utilizados:
- `/v1/chat/completions`: Generación de respuestas de chat

## Manejo de Errores

El sistema implementa manejo de errores en múltiples niveles:

1. **Nivel de API**: Captura errores HTTP y responde con códigos apropiados
2. **Nivel de Servicio**: Captura errores específicos de cada servicio externo
3. **Nivel de Controlador**: Maneja errores de procesamiento de mensajes
4. **Nivel de Usuario**: Proporciona mensajes de error amigables al usuario

Estrategia de reintentos:
- No implementada automáticamente, pero los errores se registran para análisis

## Consideraciones de Seguridad

1. **Autenticación**:
   - Verificación de webhook con token secreto
   - Autenticación de usuario mediante documento de identidad
   - Tokens de API almacenados en variables de entorno

2. **Protección de Datos**:
   - Consentimiento explícito para tratamiento de datos personales
   - No se almacenan contraseñas en texto plano
   - Validación de entrada para prevenir inyecciones

3. **Limitaciones**:
   - No hay límite de tasa implementado para mensajes entrantes
   - No hay protección contra ataques de fuerza bruta en la autenticación

## Escalabilidad

El diseño modular permite escalar horizontalmente:

1. **Stateless**: El estado del usuario podría moverse a una base de datos externa
2. **Servicios Independientes**: Cada servicio podría desplegarse como un microservicio
3. **Colas de Mensajes**: Podrían implementarse para manejar picos de tráfico

## Pruebas

Estrategias de prueba recomendadas:

1. **Pruebas Unitarias**:
   - Servicios individuales
   - Utilidades
   - Controladores con mocks

2. **Pruebas de Integración**:
   - Integración con APIs externas
   - Flujos de usuario completos

3. **Pruebas de Carga**:
   - Simulación de múltiples usuarios concurrentes
   - Verificación de rendimiento bajo carga

## Monitoreo y Logging

El sistema utiliza `console.error` y `console.log` para registro básico.

Recomendaciones para producción:
- Implementar un sistema de logging estructurado (Winston, Pino)
- Integrar con servicios de monitoreo (Datadog, New Relic)
- Configurar alertas para errores críticos

## Despliegue Detallado

### Requisitos del Servidor

- **CPU**: 2+ núcleos
- **RAM**: 2GB+ mínimo
- **Almacenamiento**: 20GB+ SSD
- **Red**: Conexión estable con acceso a Internet
- **Sistema Operativo**: Linux (recomendado), Windows Server, macOS

### Configuración de Nginx (Proxy Inverso)

```nginx
server {
    listen 80;
    server_name bot.conecta2.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Configuración de SSL con Let's Encrypt

```bash
sudo certbot --nginx -d bot.conecta2.com
```

### Configuración de PM2 (Archivo ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-bot',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3'
services:
  whatsapp-bot:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Mantenimiento y Actualizaciones

### Procedimiento de Actualización

1. Realizar cambios en el código
2. Ejecutar pruebas
3. Compilar TypeScript
4. Desplegar nueva versión
5. Verificar logs para errores

### Backup y Recuperación

Datos a respaldar:
- Código fuente
- Variables de entorno (.env)
- Logs (si son importantes)

No hay base de datos local, pero considerar respaldo de estado de usuario si se implementa persistencia.

## Limitaciones Conocidas

1. **Persistencia**: El estado del usuario se almacena en memoria, se pierde al reiniciar
2. **Concurrencia**: No optimizado para múltiples instancias sin una capa de persistencia externa
3. **Manejo de Medios**: Soporte limitado para mensajes con imágenes, audio o video
4. **Internacionalización**: No hay soporte para múltiples idiomas
5. **Analíticas**: No hay recopilación de métricas de uso

## Roadmap Sugerido

1. **Corto Plazo**:
   - Implementar persistencia de datos (Redis, MongoDB)
   - Mejorar logging y monitoreo
   - Añadir soporte para más tipos de medios

2. **Medio Plazo**:
   - Implementar analíticas de uso
   - Añadir soporte para múltiples idiomas
   - Mejorar la integración con IA para respuestas más contextuales

3. **Largo Plazo**:
   - Migrar a arquitectura de microservicios
   - Implementar aprendizaje automático para personalización
   - Añadir soporte para más canales (Telegram, Messenger)

---

© 2023 Conecta2 Telecomunicaciones SAS. Todos los derechos reservados.
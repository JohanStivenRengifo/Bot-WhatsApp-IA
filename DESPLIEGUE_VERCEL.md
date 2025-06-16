# 🚀 Guía de Despliegue en Vercel - Bot WhatsApp Conecta2

## 📋 Prerrequisitos

1. **Cuenta en Vercel**: [vercel.com](https://vercel.com)
2. **Repositorio en GitHub**: El código debe estar en un repositorio de GitHub
3. **Variables de entorno**: Configuradas según `.env.example`

## 🔧 Configuración de Variables de Entorno en Vercel

### 1. Variables del Bot WhatsApp
```env
WHATSAPP_TOKEN=tu_token_de_whatsapp
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
WEBHOOK_VERIFY_TOKEN=tu_webhook_verify_token
WEBHOOK_URL=https://tu-dominio.vercel.app
```

### 2. Variables de Base de Datos
```env
DATABASE_URL=mongodb://tu_conexion_mongodb
DB_HOST=tu_host_db
DB_PORT=tu_puerto_db
DB_USER=tu_usuario_db
DB_PASSWORD=tu_password_db
DB_NAME=tu_nombre_db
```

### 3. Variables de Azure OpenAI
```env
AZURE_OPENAI_API_KEY=tu_azure_openai_key
AZURE_OPENAI_ENDPOINT=tu_azure_openai_endpoint
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=tu_deployment_name
```

### 4. Variables de Seguridad
```env
JWT_SECRET=tu_jwt_secret_muy_seguro
ENCRYPTION_KEY=tu_encryption_key_muy_seguro
CRM_JWT_SECRET=tu_crm_jwt_secret
```

### 5. Variables del Frontend (CRM Dashboard)
```env
VITE_API_URL=https://tu-dominio.vercel.app
VITE_WS_URL=wss://tu-dominio.vercel.app
```

## 📁 Estructura del Proyecto Desplegado

```
tu-dominio.vercel.app/
├── /                     # API del Bot (Backend)
├── /api/*               # Endpoints de la API
├── /webhook/*           # Webhooks de WhatsApp
└── /dashboard/*         # CRM Dashboard (Frontend)
```

## 🔄 Proceso de Despliegue

### 1. Preparar el Repositorio
```bash
# Clonar o actualizar tu repositorio
git clone https://github.com/tu-usuario/Bot-WhatsApp-IA.git
cd Bot-WhatsApp-IA

# Asegurarse de que todos los archivos estén commiteados
git add .
git commit -m "Preparar para despliegue en Vercel"
git push origin main
```

### 2. Conectar con Vercel

1. **Ir a [vercel.com](https://vercel.com)** y hacer login
2. **Click en "New Project"**
3. **Importar tu repositorio** desde GitHub
4. **Configurar el proyecto**:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (raíz del proyecto)
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist`

### 3. Configurar Variables de Entorno

En el dashboard de Vercel:
1. **Ir a Settings > Environment Variables**
2. **Añadir todas las variables** del archivo `.env.example`
3. **Marcar las variables como "Production", "Preview", y "Development"**

### 4. Deploy

1. **Click en "Deploy"**
2. **Esperar el proceso de build** (puede tomar 2-5 minutos)
3. **Verificar que el despliegue sea exitoso**

## ✅ Verificación Post-Despliegue

### 1. Verificar el Backend
```bash
# Probar la API principal
curl https://tu-dominio.vercel.app/api/health

# Probar el webhook de WhatsApp
curl https://tu-dominio.vercel.app/webhook
```

### 2. Verificar el Frontend
- Visitar: `https://tu-dominio.vercel.app/dashboard`
- Verificar que la página de login se cargue correctamente
- Probar el login con credenciales válidas

### 3. Verificar la Integración
- Enviar un mensaje de prueba al número de WhatsApp
- Verificar que el bot responda correctamente
- Probar las funcionalidades del CRM

## 🔧 Configuración de Webhook en Meta

Una vez desplegado, configurar el webhook en Meta Business:

1. **URL del Webhook**: `https://tu-dominio.vercel.app/webhook`
2. **Token de Verificación**: El valor de `WEBHOOK_VERIFY_TOKEN`
3. **Eventos a suscribir**: `messages`, `messaging_handovers`

## 📊 Monitoreo y Logs

### Ver Logs en Vercel
1. **Ir al dashboard de Vercel**
2. **Seleccionar tu proyecto**
3. **Ir a "Functions" > "View Function Logs"**

### Logs de Aplicación
Los logs de aplicación aparecerán en la consola de Vercel en tiempo real.

## 🐛 Troubleshooting

### Errores Comunes

#### 1. Build Failure
```bash
# Error: Cannot find module
# Solución: Verificar que todas las dependencias estén en package.json
npm install
npm run build
```

#### 2. Environment Variables
```bash
# Error: Missing environment variables
# Solución: Verificar que todas las variables estén configuradas en Vercel
```

#### 3. Timeout en Functions
```bash
# Error: Function execution timed out
# Solución: Optimizar el código o aumentar el timeout en vercel.json
```

### Comandos Útiles

```bash
# Desplegar desde CLI
npx vercel

# Ver logs en tiempo real
npx vercel logs tu-dominio.vercel.app

# Configurar dominio personalizado
npx vercel domains add tu-dominio.com
```

## 🔄 Actualizaciones

Para actualizar el despliegue:

1. **Hacer cambios en el código**
2. **Commit y push a GitHub**
3. **Vercel se redesplegará automáticamente**

```bash
git add .
git commit -m "Actualización: descripción de cambios"
git push origin main
```

## 📞 Configuración Final de WhatsApp Business

### 1. Configurar Webhook
- **URL**: `https://tu-dominio.vercel.app/webhook`
- **Verificar**: Usar el token de verificación configurado

### 2. Configurar Permisos
- **messages**: Recibir mensajes
- **messaging_handovers**: Transferencias de conversación

### 3. Probar Funcionalidad
- Enviar mensaje al número
- Verificar respuesta del bot
- Probar funcionalidades del CRM

## 🎯 URLs Importantes

- **API Principal**: `https://tu-dominio.vercel.app/api`
- **CRM Dashboard**: `https://tu-dominio.vercel.app/dashboard`
- **Webhook WhatsApp**: `https://tu-dominio.vercel.app/webhook`
- **Health Check**: `https://tu-dominio.vercel.app/api/health`

## 📱 Acceso al CRM

Una vez desplegado, el CRM estará disponible en:
- **URL**: `https://tu-dominio.vercel.app/dashboard`
- **Login por defecto**: Configurar en las variables de entorno

---

## 🆘 Soporte

Si encuentras problemas:

1. **Revisar logs en Vercel**
2. **Verificar variables de entorno**
3. **Comprobar la configuración de WhatsApp Business**
4. **Verificar conectividad con la base de datos**

---

*Guía preparada para el despliegue de Bot WhatsApp Conecta2 Telecomunicaciones en Vercel*

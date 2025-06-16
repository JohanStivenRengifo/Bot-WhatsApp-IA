# 🔐 Configuración de Variables de Entorno para Vercel

## 📋 Lista de Variables Requeridas

Copia y pega estas variables en el dashboard de Vercel (Settings > Environment Variables):

### 🤖 WhatsApp Business API
```
WHATSAPP_TOKEN=EAAxxxxxxxxx (Tu token de WhatsApp Business API)
WHATSAPP_PHONE_NUMBER_ID=123456789 (ID del número de teléfono)
WEBHOOK_VERIFY_TOKEN=tu_token_verificacion_webhook
WEBHOOK_URL=https://tu-dominio.vercel.app
```

### 🗄️ Base de Datos MongoDB
```
DATABASE_URL=mongodb+srv://usuario:password@cluster.mongodb.net/database
DB_HOST=cluster.mongodb.net
DB_PORT=27017
DB_USER=tu_usuario_mongodb
DB_PASSWORD=tu_password_mongodb  
DB_NAME=bot_whatsapp_db
```

### 🧠 Azure OpenAI
```
AZURE_OPENAI_API_KEY=tu_clave_azure_openai
AZURE_OPENAI_ENDPOINT=https://tu-instancia.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-35-turbo
```

### 🔐 Seguridad y JWT
```
JWT_SECRET=super_secreto_jwt_cambiar_en_produccion_123456789
ENCRYPTION_KEY=clave_encriptacion_muy_segura_cambiar_produccion
CRM_JWT_SECRET=jwt_secreto_crm_cambiar_en_produccion_987654321
```

### 🌐 APIs Externas
```
WISPHUB_API_URL=https://api.wisphub.net
WISPHUB_API_KEY=tu_clave_wisphub_api
```

### 🖥️ Configuración del Servidor
```
PORT=3000
NODE_ENV=production
API_URL=https://tu-dominio.vercel.app
LOG_LEVEL=info
```

### 🌐 Variables del Frontend (CRM Dashboard)
```
VITE_API_URL=https://tu-dominio.vercel.app
VITE_WS_URL=wss://tu-dominio.vercel.app
```

## 🚀 Pasos para Configurar en Vercel

1. **Ve a tu proyecto en Vercel**
2. **Click en "Settings"**
3. **Click en "Environment Variables"**
4. **Para cada variable:**
   - Nombre: `NOMBRE_VARIABLE`
   - Valor: `valor_correspondiente`
   - Entornos: ✅ Production ✅ Preview ✅ Development

## ⚠️ Notas Importantes

- **🔒 JWT_SECRET**: Usa una clave larga y aleatoria (mínimo 32 caracteres)
- **🔒 ENCRYPTION_KEY**: Debe ser diferente al JWT_SECRET  
- **📱 WHATSAPP_TOKEN**: Obtener desde Meta Business Manager
- **🗄️ DATABASE_URL**: Usar MongoDB Atlas para producción
- **🧠 AZURE_OPENAI**: Configurar la instancia en Azure antes

## 🧪 Verificar Variables

Después de configurar, verifica que estén correctas:

```bash
# En el dashboard de Vercel, ve a "Functions" > "View Function Logs"
# Busca mensajes como:
# ✅ WhatsApp API configured
# ✅ Database connected  
# ✅ Azure OpenAI initialized
```

## 🔧 Troubleshooting

### Error: "Missing environment variable"
- Verifica que la variable esté configurada en Vercel
- Asegúrate de que esté marcada para "Production"

### Error: "Invalid JWT secret"
- El JWT_SECRET debe tener al menos 32 caracteres
- No usar caracteres especiales que puedan causar problemas

### Error: "Database connection failed"
- Verifica la cadena de conexión de MongoDB
- Asegúrate de que la IP de Vercel esté en la whitelist (usar 0.0.0.0/0 para permitir todas)

---

*Configuración preparada para Bot WhatsApp Conecta2 Telecomunicaciones*

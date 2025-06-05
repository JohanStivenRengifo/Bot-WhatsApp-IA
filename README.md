# 🤖 Bot Meta AI - WhatsApp Business Bot

Bot inteligente de WhatsApp Business para Conecta2 Telecomunicaciones con IA integrada (Gemini/OpenAI), gestión de soporte técnico, ventas automatizadas y integración con WispHub.

## 📋 Características

- **🧠 IA Avanzada**: Integración con Google Gemini y OpenAI
- **🔧 Soporte Técnico**: 9 flujos especializados de soporte
- **💼 Ventas Automatizadas**: Sistema de cotizaciones y generación de PDFs
- **📊 Gestión de Tickets**: Creación y seguimiento de tickets de soporte
- **💳 Gestión de Pagos**: Verificación de pagos y consulta de facturas
- **🔐 Autenticación**: Sistema seguro de verificación de clientes
- **📄 Documentos**: Generación automática de cotizaciones en PDF
- **🗄️ Base de Datos**: Integración con MongoDB para persistencia

## 🚀 Despliegue en Ubuntu VM

### 📋 Prerrequisitos

- Ubuntu 20.04 LTS o superior
- Usuario con privilegios sudo
- Conexión a internet

### 🔧 Instalación de Dependencias

#### 1. Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

#### 2. Instalar Node.js 18.x

```bash
# Instalar Node.js desde NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
```

#### 3. Instalar Docker y Docker Compose

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalación
docker --version
docker-compose --version
```

#### 4. Instalar PM2 (Gestor de Procesos)

```bash
sudo npm install -g pm2
```

#### 5. Instalar Git

```bash
sudo apt install git -y
```

### 📥 Clonación y Configuración del Proyecto

#### 1. Clonar el repositorio

```bash
cd /opt
sudo git clone https://github.com/JohanStivenRengifo/Bot-Meta.git bot-meta-ai
sudo chown -R $USER:$USER /opt/bot-meta-ai
cd /opt/bot-meta-ai
```

#### 2. Instalar dependencias

```bash
npm install
```

#### 3. Compilar el proyecto

```bash
npm run build
```

### ⚙️ Configuración de Variables de Entorno

#### 1. Crear archivo .env

```bash
cp .env.example .env
nano .env
```

#### 2. Configurar variables requeridas

```env
# ===== META/WhatsApp Business API =====
META_ACCESS_TOKEN=your_meta_access_token_here
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
PHONE_NUMBER_ID=your_phone_number_id_here

# ===== WispHub API =====
WISPHUB_API_URL=https://your-wisphub-api.com/api/
WISPHUB_API_KEY=your_wisphub_api_key_here

# ===== CRM API =====
CRM_API_URL=https://your-crm-api.com/api/
CRM_API_KEY=your_crm_api_key_here

# ===== IA Services =====
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
AI_PRIMARY_SERVICE=gemini
AI_FALLBACK_SERVICE=openai

# ===== MongoDB =====
MONGODB_URI=mongodb://localhost:27017/bot-meta-ai

# ===== Server =====
PORT=3000
NODE_ENV=production

# ===== Security =====
ENCRYPTION_KEY=your_32_character_encryption_key_here
JWT_SECRET=your_jwt_secret_here

# ===== Logs =====
LOG_LEVEL=info
```

### 🗄️ Configuración de MongoDB

#### 1. Instalar MongoDB

```bash
# Importar clave pública MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Crear archivo de lista para MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Actualizar repositorios e instalar
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verificar estado
sudo systemctl status mongod
```

#### 2. Configurar MongoDB (Opcional - para producción)

```bash
# Configurar autenticación MongoDB
mongo --port 27017
```

```javascript
// Crear usuario administrador
use admin
db.createUser({
  user: "admin",
  pwd: "your_secure_password",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

// Crear usuario para la aplicación
use bot-meta-ai
db.createUser({
  user: "botuser",
  pwd: "your_bot_password", 
  roles: [ { role: "readWrite", db: "bot-meta-ai" } ]
})
```

### 🔧 Configuración del Firewall

```bash
# Permitir tráfico SSH, HTTP y HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000

# Habilitar firewall
sudo ufw --force enable
```

## 🪟 Despliegue en Windows con Docker

### 📋 Prerrequisitos para Windows

- Windows 10/11 Pro, Enterprise o Education
- Docker Desktop para Windows
- PowerShell 5.1 o superior
- Git para Windows

### 🔧 Instalación de Dependencias en Windows

#### 1. Instalar Docker Desktop

1. Descargar Docker Desktop desde [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Ejecutar el instalador y seguir las instrucciones
3. Reiniciar el sistema si es necesario
4. Verificar instalación:

```powershell
docker --version
docker-compose --version
```

#### 2. Instalar Git para Windows

1. Descargar desde [git-scm.com](https://git-scm.com/download/win)
2. Instalar con configuración por defecto
3. Verificar instalación:

```powershell
git --version
```

#### 3. Configurar PowerShell (Opcional)

Para permitir ejecución de scripts:

```powershell
# Ejecutar como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 📥 Clonación y Configuración en Windows

#### 1. Clonar el repositorio

```powershell
# Crear directorio para aplicaciones
mkdir C:\Apps
cd C:\Apps

# Clonar repositorio
git clone https://github.com/JohanStivenRengifo/Bot-Meta.git Bot-Meta-AI
cd Bot-Meta-AI
```

#### 2. Configurar variables de entorno

```powershell
# Copiar archivo de ejemplo
copy .env.example .env

# Editar con notepad o tu editor preferido
notepad .env
```

### 🚀 Despliegue Automatizado con PowerShell

#### Opción 1: Script de Despliegue Automático

```powershell
# Ejecutar script de despliegue
.\scripts\deploy-docker.ps1
```

Este script automáticamente:
- ✅ Verifica dependencias (Docker, Docker Compose)
- ✅ Valida archivo `.env`
- ✅ Crea directorios necesarios
- ✅ Construye y despliega servicios
- ✅ Verifica estado de servicios
- ✅ Muestra información de conexión

#### Opción 2: Despliegue Manual

```powershell
# Verificar que Docker está ejecutándose
docker info

# Construir y ejecutar servicios
docker-compose -f docker-compose.production.yml up -d --build

# Verificar estado
docker-compose -f docker-compose.production.yml ps
```

### 🔧 Gestión de Servicios con PowerShell

#### Script de Utilidades

El proyecto incluye un script de utilidades para gestionar los contenedores:

```powershell
# Ver estado de servicios
.\scripts\docker-utils.ps1 status

# Ver logs en tiempo real
.\scripts\docker-utils.ps1 logs

# Ver logs de un servicio específico
.\scripts\docker-utils.ps1 logs -Service bot-app -Lines 100

# Reiniciar servicios
.\scripts\docker-utils.ps1 restart

# Actualizar servicios
.\scripts\docker-utils.ps1 update

# Crear backup de MongoDB
.\scripts\docker-utils.ps1 backup

# Restaurar backup
.\scripts\docker-utils.ps1 restore

# Abrir shell en contenedor
.\scripts\docker-utils.ps1 shell -Service bot-app

# Ver ayuda completa
.\scripts\docker-utils.ps1 -h
```

#### Comandos Docker Manuales

```powershell
# Ver estado de contenedores
docker-compose -f docker-compose.production.yml ps

# Ver logs
docker-compose -f docker-compose.production.yml logs -f

# Reiniciar servicios
docker-compose -f docker-compose.production.yml restart

# Parar servicios
docker-compose -f docker-compose.production.yml down

# Actualizar servicios
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d --build

# Limpiar sistema Docker
docker system prune -f
```

### 📊 Monitoreo en Windows

#### Ver Logs

```powershell
# Logs en tiempo real de todos los servicios
docker-compose -f docker-compose.production.yml logs -f

# Logs de un servicio específico
docker-compose -f docker-compose.production.yml logs -f bot-app

# Últimas 100 líneas de logs
docker-compose -f docker-compose.production.yml logs --tail=100
```

#### Verificar Estado

```powershell
# Estado de contenedores
docker ps

# Uso de recursos
docker stats

# Información de volúmenes
docker volume ls

# Información de redes
docker network ls
```

### 🔄 Actualizaciones en Windows

#### Script de Actualización PowerShell

```powershell
# Crear script de actualización
@'
# Script de actualización para Bot Meta AI
Write-Host "🔄 Actualizando Bot Meta AI..." -ForegroundColor Blue

# Ir al directorio del proyecto
cd C:\Apps\Bot-Meta-AI

# Hacer backup de .env
Copy-Item .env .env.backup

# Actualizar código
git pull origin main

# Actualizar y reiniciar servicios
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d --build

Write-Host "✅ Actualización completada" -ForegroundColor Green
'@ | Out-File -FilePath "update.ps1" -Encoding UTF8

# Ejecutar actualización
.\update.ps1
```

### 🩺 Troubleshooting en Windows

#### Problemas Comunes

1. **Docker Desktop no inicia**
   ```powershell
   # Reiniciar Docker Desktop
   Restart-Service -Name com.docker.service -Force
   
   # O reiniciar desde GUI
   # Click derecho en icono Docker -> Restart
   ```

2. **Puerto ocupado**
   ```powershell
   # Ver qué usa el puerto 3000
   netstat -ano | findstr :3000
   
   # Matar proceso por PID
   taskkill /PID <PID> /F
   ```

3. **Problemas de permisos con volúmenes**
   ```powershell
   # Verificar configuración de Docker Desktop
   # Settings -> Resources -> File Sharing
   # Agregar C:\Apps\Bot-Meta-AI si no está
   ```

4. **Variables de entorno no se cargan**
   ```powershell
   # Verificar archivo .env
   Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_ -ne '' }
   ```

#### Logs Importantes

```powershell
# Logs de Docker Desktop
# %LOCALAPPDATA%\Docker\log\

# Logs de contenedores
docker-compose -f docker-compose.production.yml logs

# Logs del sistema Windows
# Usar Event Viewer (eventvwr.msc)
```

### 🔐 Configuración de Windows Defender

```powershell
# Agregar exclusiones para Docker (ejecutar como Administrador)
Add-MpPreference -ExclusionPath "C:\ProgramData\Docker"
Add-MpPreference -ExclusionPath "C:\Users\$env:USERNAME\.docker"
Add-MpPreference -ExclusionPath "C:\Apps\Bot-Meta-AI"
```

### 🚀 Despliegue

#### Opción 1: Despliegue con PM2 (Recomendado)

```bash
# Crear archivo de configuración PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'bot-meta-ai',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/pm2/bot-meta-ai.log',
    out_file: '/var/log/pm2/bot-meta-ai-out.log',
    error_file: '/var/log/pm2/bot-meta-ai-error.log',
    time: true
  }]
};
EOF

# Crear directorio de logs
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Iniciar aplicación con PM2
pm2 start ecosystem.config.js

# Configurar PM2 para auto-inicio
pm2 startup
pm2 save
```

#### Opción 2: Despliegue con Docker

##### 2.1. Construir y ejecutar manualmente

```bash
# Construir imagen
docker build -t bot-meta-ai:latest .

# Crear red personalizada
docker network create bot-network

# Ejecutar MongoDB
docker run -d \
  --name bot-mongo \
  --network bot-network \
  --restart always \
  -v bot-mongo-data:/data/db \
  -p 27017:27017 \
  mongo:6.0

# Ejecutar aplicación
docker run -d \
  --name bot-meta-ai \
  --network bot-network \
  --restart always \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/temp:/app/temp \
  bot-meta-ai:latest
```

##### 2.2. Usando Docker con MongoDB externo

```bash
# Solo ejecutar la aplicación (MongoDB externo)
docker run -d \
  --name bot-meta-ai \
  --restart always \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/temp:/app/temp \
  -v $(pwd)/logs:/app/logs \
  bot-meta-ai:latest
```

#### Opción 3: Despliegue con Docker Compose (Recomendado)

##### 3.1. Configuración completa con MongoDB

```bash
# Crear archivo docker-compose.production.yml
cat > docker-compose.production.yml << 'EOF'
version: '3.8'

services:
  bot-app:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: bot-meta-ai
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://bot-mongo:27017/bot-meta-ai
    volumes:
      - ./temp:/app/temp
      - ./logs:/app/logs
    depends_on:
      - bot-mongo
    networks:
      - bot-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  bot-mongo:
    image: mongo:6.0
    container_name: bot-mongo
    restart: always
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=your_secure_password
      - MONGO_INITDB_DATABASE=bot-meta-ai
    volumes:
      - bot-mongo-data:/data/db
      - ./mongo-init:/docker-entrypoint-initdb.d
    networks:
      - bot-network
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "3"

volumes:
  bot-mongo-data:
    driver: local

networks:
  bot-network:
    driver: bridge
EOF

# Ejecutar con docker-compose
docker-compose -f docker-compose.production.yml up -d

# Ver logs
docker-compose -f docker-compose.production.yml logs -f
```

##### 3.2. Solo aplicación (MongoDB externo)

```bash
# Usar el docker-compose.yml existente
docker-compose up -d

# Ver logs
docker-compose logs -f bot-meta-ai
```

##### 3.3. Comandos útiles de Docker Compose

```bash
# Parar servicios
docker-compose down

# Reiniciar servicios
docker-compose restart

# Ver estado
docker-compose ps

# Actualizar y reiniciar
docker-compose pull && docker-compose up -d

# Limpiar y reconstruir
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### 🔍 Verificación del Despliegue

#### 1. Verificar que el servicio está ejecutándose

```bash
# Con PM2
pm2 status
pm2 logs bot-meta-ai

# Con Docker
docker ps
docker logs bot-meta-ai

# Verificar puerto
sudo netstat -tlnp | grep :3000
```

#### 2. Probar endpoint de salud

```bash
curl http://localhost:3000/health
```

#### 3. Verificar webhook

```bash
curl -X GET "http://localhost:3000/webhook?hub.verify_token=your_verify_token&hub.challenge=test&hub.mode=subscribe"
```

### 🌐 Configuración de Nginx (Reverse Proxy)

#### 1. Instalar Nginx

```bash
sudo apt install nginx -y
```

#### 2. Configurar virtual host

```bash
sudo nano /etc/nginx/sites-available/bot-meta-ai
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

#### 3. Habilitar sitio

```bash
sudo ln -s /etc/nginx/sites-available/bot-meta-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 🔒 SSL con Certbot (Opcional)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
sudo certbot --nginx -d your-domain.com

# Verificar renovación automática
sudo certbot renew --dry-run
```

### 📊 Monitoreo y Logs

#### 1. Ver logs en tiempo real

```bash
# PM2
pm2 logs bot-meta-ai --lines 50

# Docker
docker logs -f bot-meta-ai

# Sistema
sudo journalctl -u bot-meta-ai -f
```

#### 2. Monitoreo con PM2

```bash
# Dashboard de PM2
pm2 monit

# Reiniciar aplicación
pm2 restart bot-meta-ai

# Recargar configuración
pm2 reload bot-meta-ai
```

### 🔄 Actualizaciones

#### Script de actualización

```bash
cat > update.sh << 'EOF'
#!/bin/bash

echo "🔄 Actualizando Bot Meta AI..."

# Ir al directorio del proyecto
cd /opt/bot-meta-ai

# Hacer backup de .env
cp .env .env.backup

# Actualizar código
git pull origin main

# Instalar dependencias
npm install

# Compilar proyecto
npm run build

# Reiniciar servicio
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart bot-meta-ai
    echo "✅ Aplicación reiniciada con PM2"
elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose down
    docker-compose up -d --build
    echo "✅ Aplicación reiniciada con Docker Compose"
else
    echo "⚠️ Reinicia manualmente el servicio"
fi

echo "✅ Actualización completada"
EOF

chmod +x update.sh
```

### 🩺 Troubleshooting

#### Problemas Comunes

1. **Puerto 3000 ocupado**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **Problemas de permisos**
   ```bash
   sudo chown -R $USER:$USER /opt/bot-meta-ai
   ```

3. **MongoDB no conecta**
   ```bash
   sudo systemctl status mongod
   sudo tail -f /var/log/mongodb/mongod.log
   ```

4. **Variables de entorno no cargadas**
   ```bash
   # Verificar .env
   cat .env | grep -v '^#'
   ```

#### Logs importantes

```bash
# Logs del sistema
sudo journalctl -xe

# Logs de nginx
sudo tail -f /var/log/nginx/error.log

# Logs de MongoDB
sudo tail -f /var/log/mongodb/mongod.log

# Logs de la aplicación
pm2 logs bot-meta-ai
```

### 📱 Configuración de WhatsApp Business

1. **Configurar Webhook URL**: `https://your-domain.com/webhook`
2. **Configurar Verify Token**: El mismo que configuraste en `.env`
3. **Suscribirse a eventos**: `messages`, `message_deliveries`, `message_reads`

### 🔐 Configuración de Seguridad Adicional

#### 1. Configurar fail2ban

```bash
sudo apt install fail2ban -y

# Configurar reglas para SSH
sudo nano /etc/fail2ban/jail.local
```

```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

#### 2. Actualizar sistema automáticamente

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 📈 Optimización de Rendimiento

#### 1. Configurar limits del sistema

```bash
# Aumentar límites de archivos abiertos
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
```

#### 2. Configurar swap (si es necesario)

```bash
# Crear archivo swap de 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Hacer permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 🆘 Soporte

- **Documentación**: Ver archivos en `/docs`
- **Issues**: [GitHub Issues](https://github.com/JohanStivenRengifo/Bot-Meta/issues)
- **Logs**: Revisa siempre los logs para diagnosticar problemas

## 📄 Licencia

ISC License - Ver archivo `LICENSE` para más detalles.

---

**¡Tu Bot Meta AI está listo para funcionar en Ubuntu! 🚀**

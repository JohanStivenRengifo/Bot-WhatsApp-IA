@echo off
REM filepath: c:\Apps\Bot-Meta-AI\scripts\start-production.bat

echo 🚀 Iniciando sistema completo en modo producción...

REM Verificar variables de entorno
if "%DATABASE_URL%"=="" (
    echo ⚠️ Advertencia: DATABASE_URL no está configurada
)

if "%JWT_SECRET%"=="" (
    echo ⚠️ Advertencia: JWT_SECRET no está configurada
)

REM Construir el proyecto
echo 📦 Construyendo backend...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Error construyendo backend
    exit /b 1
)

echo 📦 Construyendo CRM backend...
call npm run crm:build
if %errorlevel% neq 0 (
    echo ❌ Error construyendo CRM
    exit /b 1
)

echo 📦 Construyendo frontend...
call npm run frontend:build
if %errorlevel% neq 0 (
    echo ❌ Error construyendo frontend
    exit /b 1
)

REM Verificar archivos compilados
if not exist "dist\index.js" (
    echo ❌ Error: Bot principal no compilado
    exit /b 1
)

if not exist "dist\crm\start-crm.js" (
    echo ❌ Error: CRM no compilado
    exit /b 1
)

if not exist "crm-turbo-frontend\.next" (
    echo ❌ Error: Frontend no compilado
    exit /b 1
)

echo ✅ Construcción completada

REM Iniciar servicios
echo 🚀 Iniciando servicios...
call npm run start:all

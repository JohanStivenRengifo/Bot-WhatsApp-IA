# 🚀 Instrucciones de Despliegue Actualizadas - Vercel

## ✅ Configuración Correcta del Proyecto

### Configuración en Vercel Dashboard:
```
Framework Preset: Other
Root Directory: ./ (raíz del proyecto)
Build Command: npm run vercel-build
Output Directory: (dejar vacío)
Install Command: npm install
```

## 🎯 URLs del Proyecto Desplegado

Después del despliegue exitoso, las URLs serán:

- **🏠 Página Principal**: `https://tu-dominio.vercel.app/` (redirige al dashboard)
- **💼 CRM Dashboard**: `https://tu-dominio.vercel.app/crm-dashboard/`
- **🤖 API Bot**: `https://tu-dominio.vercel.app/api/*`
- **📞 Webhook WhatsApp**: `https://tu-dominio.vercel.app/webhook/*`
- **⚡ API CRM**: `https://tu-dominio.vercel.app/crm/*`

## 🔧 Cambios Realizados

1. **Configuración de rutas en `vercel.json`**:
   - Frontend CRM se sirve en `/dashboard/`
   - APIs del backend en `/api/`, `/webhook/`, `/crm/`
   - Raíz `/` redirige al dashboard

2. **Estructura de archivos**:
   - Backend: `/api/src/index.ts` (función serverless)
   - Frontend: `/crm-dashboard/dist/` (archivos estáticos)

3. **Variables de entorno importantes**:
   ```bash
   VITE_API_URL=https://tu-dominio.vercel.app
   VITE_WS_URL=wss://tu-dominio.vercel.app
   ```

## 🔄 Configuración de WhatsApp Webhook

Usa esta URL en Meta Developers Console:
```
https://tu-dominio.vercel.app/webhook
```

## 🧪 Pruebas Post-Despliegue

1. **Accede al CRM**: `https://tu-dominio.vercel.app/dashboard/`
2. **Prueba la API**: `https://tu-dominio.vercel.app/api/health` (si existe)
3. **Verifica el webhook**: Envía un mensaje de prueba desde WhatsApp

El proyecto ahora debería funcionar correctamente con el CRM Dashboard accesible desde `/dashboard/` 🎉

# Guía para Descarga de Medios en WhatsApp Business API

## Contexto del Problema

Cuando se reciben mensajes con medios (imágenes, documentos, videos, etc.) a través de la API de WhatsApp Business, el proceso para descargar estos medios ha cambiado con las versiones recientes de la API.

## Solución Implementada

Hemos actualizado el servicio `ImageStorageService` para utilizar el enfoque correcto de descarga de medios en dos pasos:

1. **Obtener la URL temporal de descarga** utilizando el ID del medio
2. **Descargar el medio** utilizando la URL temporal obtenida

## Proceso Correcto para Descargar Medios

### Paso 1: Obtener la URL de Descarga

```typescript
// URL para obtener metadatos del medio y URL de descarga
const mediaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;

// Obtener la información del medio
const mediaResponse = await axios.get(mediaUrl, {
    headers: {
        'Authorization': `Bearer ${accessToken}`
    }
});

// Extraer la URL de descarga temporal
const downloadUrl = mediaResponse.data.url;
```

### Paso 2: Descargar el Medio

```typescript
// Descargar el medio usando la URL temporal
const mediaData = await axios.get(downloadUrl, {
    headers: {
        'Authorization': `Bearer ${accessToken}`
    },
    responseType: 'arraybuffer'
});

// Ahora mediaData.data contiene el medio en formato binario
```

## Manejo de IDs de Medios

Los IDs de medios de WhatsApp pueden venir en distintos formatos:

- **Formato completo:** `wamid.HBgMNTczMTE2MDM1NzkxFQIAEhgWM0VCMDlGRENFNkEzNUJDQzIzODI1MgA=`
- **Otros formatos:** Depende de la implementación específica de Meta

Es importante usar el ID completo (incluyendo el prefijo `wamid.` si está presente) cuando se hacen solicitudes a la API.

## Manejo de Errores Comunes

### Error 400: Unknown path components

Este error ocurre cuando se usa una URL incorrecta para acceder a los medios. Asegúrate de:

1. Usar el ID completo del medio
2. Utilizar el enfoque de dos pasos (obtener URL temporal primero)
3. No intentar acceder directamente a `/media/{mediaId}`

### Error 401: Unauthorized

Asegúrate de que el token de acceso es válido y tiene los permisos adecuados.

### Error 404: Not Found

El ID del medio puede ser incorrecto o el medio puede haber expirado (los medios de WhatsApp tienen un tiempo de vida limitado).

## Scripts de Prueba

Para probar la descarga de medios, puedes usar el script:

```bash
ts-node src/scripts/test-whatsapp-media.ts <ID_DEL_MEDIO>
```

Esto mostrará todo el proceso paso a paso y te ayudará a identificar cualquier problema.

## Actualización de API

Meta actualiza constantemente su API. Actualmente, la API ha sido auto-actualizada a v22.0:

```
x-ad-api-version-warning: The call has been auto-upgraded to v22.0 as v18.0 has been deprecated.
```

Es recomendable mantener actualizada la versión de la API en la configuración para evitar problemas de compatibilidad.

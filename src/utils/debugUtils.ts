import fs from 'fs';
import path from 'path';
import { WhatsAppMessage } from '../interfaces';

/**
 * Asegura que el directorio de logs exista
 * @returns Path al directorio de logs
 */
function ensureLogDirectory(): string {
    const logDir = path.join(process.cwd(), 'logs');

    // Crear directorio si no existe
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    return logDir;
}

/**
 * Utilidad para depurar mensajes de WhatsApp
 * Guarda los mensajes en un archivo de log para análisis posterior
 */
export function logMessageStructure(message: WhatsAppMessage | any, source: string): void {
    try {
        const logDir = ensureLogDirectory();
        const logFile = path.join(logDir, 'message-debug.log');
        const timestamp = new Date().toISOString();

        // Preparar datos para el log
        const logData = {
            timestamp,
            source,
            messageType: message.type,
            hasImage: !!message.image,
            hasDocument: !!message.document,
            hasMedia: !!(message as any).media,
            messageStructure: message
        };

        // Escribir en el archivo de log
        fs.appendFileSync(
            logFile,
            `\n------- DEBUG ${timestamp} -------\n` +
            JSON.stringify(logData, null, 2) +
            '\n--------------------------------\n'
        ); console.log(`[DEBUG] Mensaje registrado en ${logFile} desde ${source}`);
    } catch (error) {
        console.error('Error al registrar mensaje para depuración:', error);
    }
}

/**
 * Registra errores de integración con servicios externos
 * @param serviceName Nombre del servicio (ej: 'WispHub', 'Meta', etc)
 * @param endpoint Endpoint que causó el error
 * @param error Error original
 */
export function logIntegrationError(serviceName: string, endpoint: string, error: any): void {
    try {
        const logDir = ensureLogDirectory();
        const logFile = path.join(logDir, 'integration-errors.log');
        const timestamp = new Date().toISOString();

        let errorDetails: string;
        if (error.response) {
            // Error de respuesta del servidor
            errorDetails = JSON.stringify({
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            }, null, 2);
        } else if (error.request) {
            // No se recibió respuesta
            errorDetails = `No se recibió respuesta del servidor: ${error.request}`;
        } else {
            // Error en la configuración de la solicitud
            errorDetails = error.message || JSON.stringify(error);
        }

        const logEntry = `
========== ERROR DE INTEGRACIÓN (${timestamp}) ==========
Servicio: ${serviceName}
Endpoint: ${endpoint}
Detalles:
${errorDetails}
========================================================
`;

        fs.appendFileSync(logFile, logEntry);
        console.error(`[ERROR] Error de integración con ${serviceName}. Detalles guardados en ${logFile}`);
    } catch (logError) {
        console.error('Error al registrar error de integración:', logError);
    }
}

/**
 * Extrae el ID de medio de un mensaje de WhatsApp, independientemente
 * de su formato o tipo
 */
export function extractMediaId(message: WhatsAppMessage | any): string | null {
    try {
        // Registrar mensaje para depuración
        logMessageStructure(message, 'extractMediaId');

        // Casos conocidos
        if (message.image && message.image.id) {
            return message.image.id;
        }

        if (message.document && message.document.id) {
            return message.document.id;
        }

        if (message.video && message.video.id) {
            return message.video.id;
        }

        if (message.audio && message.audio.id) {
            return message.audio.id;
        }

        // Caso genérico para la propiedad media
        if (message.media && message.media.id) {
            return message.media.id;
        }

        // Propiedad mediaId directa
        if (message.mediaId) {
            return message.mediaId;
        }

        // Buscar recursivamente por cualquier propiedad que termine en "id"
        const findIdProperty = (obj: any): string | null => {
            if (!obj || typeof obj !== 'object') return null;

            // Buscar propiedades que terminen en "id" directamente en el objeto
            for (const key in obj) {
                if (key.toLowerCase().endsWith('id') && typeof obj[key] === 'string') {
                    return obj[key];
                }

                // Buscar en objetos anidados
                if (typeof obj[key] === 'object') {
                    const nestedId = findIdProperty(obj[key]);
                    if (nestedId) return nestedId;
                }
            }

            return null;
        };

        return findIdProperty(message);
    } catch (error) {
        console.error('Error al extraer ID de medio:', error);
        return null;
    }
}

/**
 * Limpia un ID de medio de WhatsApp para asegurarse de que tenga el formato correcto
 * para ser utilizado con la API de WhatsApp Business
 */
export function cleanMediaId(mediaId: string | null): string | null {
    if (!mediaId) return null;

    // Si el ID ya está en un formato limpio, devolverlo
    if (/^[0-9]+$/.test(mediaId)) {
        return mediaId;
    }

    try {
        // Según la nueva documentación de WhatsApp Business API, debemos usar el ID completo
        // para los formatos "wamid.*"
        if (mediaId.startsWith('wamid.')) {
            return mediaId; // Devolver el ID completo, no solo la parte después del punto
        }

        // Cualquier otro formato, lo devolvemos tal cual
        return mediaId;
    } catch (error) {
        console.error('Error al limpiar ID de medio:', error);
        return mediaId;
    }
}

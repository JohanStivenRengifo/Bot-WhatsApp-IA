import fs from 'fs';
import path from 'path';
import { WhatsAppMessage } from '../interfaces';

/**
 * Utilidad para depurar mensajes de WhatsApp
 * Guarda los mensajes en un archivo de log para análisis posterior
 */
export function logMessageStructure(message: WhatsAppMessage | any, source: string): void {
    try {
        const logDir = path.join(process.cwd(), 'logs');

        // Crear directorio si no existe
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

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
        );

        console.log(`[DEBUG] Mensaje registrado en ${logFile} desde ${source}`);
    } catch (error) {
        console.error('Error al registrar mensaje para depuración:', error);
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

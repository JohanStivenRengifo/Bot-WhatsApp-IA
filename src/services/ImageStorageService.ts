import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../config';

export interface ImageMetadata {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    timestamp: Date;
    userPhone: string;
    purpose: 'payment_receipt' | 'general';
    localPath: string;
    originalUrl?: string;
}

export class ImageStorageService {
    private static readonly IMAGES_DIR = path.join(process.cwd(), 'images');
    private static readonly RECEIPTS_DIR = path.join(ImageStorageService.IMAGES_DIR, 'receipts');

    constructor() {
        this.ensureDirectoriesExist();
    }

    /**
     * Asegura que los directorios de almacenamiento existan
     */
    private ensureDirectoriesExist(): void {
        if (!fs.existsSync(ImageStorageService.IMAGES_DIR)) {
            fs.mkdirSync(ImageStorageService.IMAGES_DIR, { recursive: true });
        }
        if (!fs.existsSync(ImageStorageService.RECEIPTS_DIR)) {
            fs.mkdirSync(ImageStorageService.RECEIPTS_DIR, { recursive: true });
        }
    }

    /**
     * Descarga y guarda una imagen desde WhatsApp
     */
    async downloadAndSaveImage(
        imageId: string,
        userPhone: string,
        purpose: 'payment_receipt' | 'general' = 'general'
    ): Promise<ImageMetadata | null> {
        try {
            console.log(`📥 Descargando imagen ${imageId} para usuario ${userPhone}`);

            // Obtener metadata de la imagen desde WhatsApp API
            const mediaResponse = await axios.get(
                `https://graph.facebook.com/${config.meta.version}/${imageId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.meta.accessToken}`
                    }
                }
            );

            const mediaData = mediaResponse.data;
            const mediaUrl = mediaData.url;
            const mimeType = mediaData.mime_type || 'image/jpeg';

            // Descargar la imagen
            const imageResponse = await axios.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${config.meta.accessToken}`
                },
                responseType: 'arraybuffer'
            });

            // Generar nombre de archivo único
            const timestamp = new Date();
            const extension = this.getExtensionFromMimeType(mimeType);
            const fileName = `${userPhone}_${timestamp.getTime()}_${imageId}${extension}`;

            // Determinar directorio según el propósito
            const targetDir = purpose === 'payment_receipt' ? ImageStorageService.RECEIPTS_DIR : ImageStorageService.IMAGES_DIR;
            const filePath = path.join(targetDir, fileName);

            // Guardar archivo
            fs.writeFileSync(filePath, imageResponse.data);

            const metadata: ImageMetadata = {
                id: imageId,
                originalName: fileName,
                mimeType: mimeType,
                size: imageResponse.data.length,
                timestamp: timestamp,
                userPhone: userPhone,
                purpose: purpose,
                localPath: filePath,
                originalUrl: mediaUrl
            };

            console.log(`✅ Imagen guardada exitosamente: ${filePath}`);
            console.log(`📊 Tamaño: ${Math.round(metadata.size / 1024)} KB`);

            return metadata;

        } catch (error) {
            console.error('❌ Error descargando imagen:', error);
            return null;
        }
    }

    /**
     * Obtiene la extensión de archivo basada en el tipo MIME
     */
    private getExtensionFromMimeType(mimeType: string): string {
        const mimeToExt: { [key: string]: string } = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp',
            'image/tiff': '.tiff'
        };

        return mimeToExt[mimeType.toLowerCase()] || '.jpg';
    }

    /**
     * Lista imágenes de un usuario
     */
    listUserImages(userPhone: string, purpose?: 'payment_receipt' | 'general'): ImageMetadata[] {
        try {
            const targetDir = purpose === 'payment_receipt' ? ImageStorageService.RECEIPTS_DIR : ImageStorageService.IMAGES_DIR;

            if (!fs.existsSync(targetDir)) {
                return [];
            }

            const files = fs.readdirSync(targetDir);
            const userFiles = files.filter(file => file.startsWith(userPhone));

            return userFiles.map(file => {
                const filePath = path.join(targetDir, file);
                const stats = fs.statSync(filePath);

                // Extraer metadata del nombre del archivo
                const parts = file.split('_');
                const timestamp = parts[1] ? new Date(parseInt(parts[1])) : stats.birthtime;
                const imageId = parts[2] ? parts[2].split('.')[0] : 'unknown';

                return {
                    id: imageId,
                    originalName: file,
                    mimeType: this.getMimeTypeFromExtension(path.extname(file)),
                    size: stats.size,
                    timestamp: timestamp,
                    userPhone: userPhone,
                    purpose: purpose || 'general',
                    localPath: filePath
                };
            }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        } catch (error) {
            console.error('Error listando imágenes de usuario:', error);
            return [];
        }
    }

    /**
     * Obtiene el tipo MIME basado en la extensión
     */
    private getMimeTypeFromExtension(extension: string): string {
        const extToMime: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff'
        };

        return extToMime[extension.toLowerCase()] || 'image/jpeg';
    }

    /**
     * Elimina una imagen
     */
    deleteImage(imagePath: string): boolean {
        try {
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log(`🗑️ Imagen eliminada: ${imagePath}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error eliminando imagen:', error);
            return false;
        }
    }

    /**
     * Limpia imágenes antiguas (más de 30 días)
     */
    cleanupOldImages(daysOld: number = 30): void {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            [ImageStorageService.IMAGES_DIR, ImageStorageService.RECEIPTS_DIR].forEach(dir => {
                if (!fs.existsSync(dir)) return;

                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);

                    if (stats.birthtime < cutoffDate) {
                        this.deleteImage(filePath);
                    }
                });
            });

        } catch (error) {
            console.error('Error limpiando imágenes antiguas:', error);
        }
    }

    /**
     * Obtiene información de almacenamiento
     */
    getStorageInfo(): { totalImages: number; totalSize: number; receiptsCount: number } {
        try {
            let totalImages = 0;
            let totalSize = 0;
            let receiptsCount = 0;

            [ImageStorageService.IMAGES_DIR, ImageStorageService.RECEIPTS_DIR].forEach(dir => {
                if (!fs.existsSync(dir)) return;

                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    totalImages++;
                    totalSize += stats.size;

                    if (dir === ImageStorageService.RECEIPTS_DIR) {
                        receiptsCount++;
                    }
                });
            });

            return { totalImages, totalSize, receiptsCount };
        } catch (error) {
            console.error('Error obteniendo información de almacenamiento:', error);
            return { totalImages: 0, totalSize: 0, receiptsCount: 0 };
        }
    }
}

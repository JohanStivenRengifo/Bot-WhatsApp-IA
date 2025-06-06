import { InvoiceCacheService } from '../services/InvoiceCacheService';
import fs from 'fs';
import path from 'path';

describe('InvoiceCacheService', () => {
    let invoiceCacheService: InvoiceCacheService;
    const testApiKey = 'Api-Key mHHsEQKX.Uc1BQzXFOCXUno64ZTM9K4vaDPjH9gLq';
    const testApiUrl = 'https://api.wisphub.app/api/facturas/';
    const cacheFilePath = path.join(process.cwd(), 'invoices_cache.json');

    beforeEach(() => {
        // Eliminar archivo de caché de prueba si existe
        if (fs.existsSync(cacheFilePath)) {
            fs.unlinkSync(cacheFilePath);
        }
        
        invoiceCacheService = new InvoiceCacheService(testApiKey, testApiUrl);
    });

    afterEach(() => {
        // Limpiar archivo de caché después de cada prueba
        if (fs.existsSync(cacheFilePath)) {
            fs.unlinkSync(cacheFilePath);
        }
    });

    test('should initialize cache file on creation', () => {
        expect(fs.existsSync(cacheFilePath)).toBe(true);
        
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        expect(cacheData.metadata.version).toBe('1.0.0');
        expect(cacheData.invoices).toEqual([]);
        expect(cacheData.totalInvoices).toBe(0);
    });

    test('should get cache statistics', () => {
        const stats = invoiceCacheService.getCacheStats();
        
        expect(stats).toHaveProperty('totalInvoices');
        expect(stats).toHaveProperty('lastFullSync');
        expect(stats).toHaveProperty('dateRangesCached');
        expect(stats).toHaveProperty('fileSizeKB');
        expect(stats).toHaveProperty('cacheVersion');
        expect(stats.totalInvoices).toBe(0);
        expect(stats.cacheVersion).toBe('1.0.0');
    });

    test('should filter invoices for client from empty cache', () => {
        const userData = {
            service_id: '12345',
            cedula: '1234567890',
            telefono: '573001234567'
        };

        const invoices = invoiceCacheService.getInvoicesForClient('12345', userData);
        expect(invoices).toEqual([]);
    });

    test('should handle date range filtering', () => {
        const userData = {
            service_id: '12345',
            cedula: '1234567890',
            telefono: '573001234567'
        };

        const dateRange = {
            start: '2024-01-01',
            end: '2024-12-31'
        };

        const invoices = invoiceCacheService.getInvoicesForClient('12345', userData, dateRange);
        expect(invoices).toEqual([]);
    });
});

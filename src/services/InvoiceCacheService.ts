import fs from 'fs';
import path from 'path';
import axios from 'axios';

export interface CachedInvoice {
    id: string;
    numero?: string;
    amount: number;
    monto: number;
    dueDate: Date;
    fecha_vencimiento: string;
    fecha_emision: string;
    status: string;
    estado: string;
    cliente: {
        usuario?: string;
        cedula?: string;
        telefono?: string;
        nombre?: string;
        id?: string;
    };
    // Campos originales completos para preservar toda la información
    originalData: any;
    // Metadatos del caché
    cacheTimestamp: number;
    lastUpdated: string;
}

export interface InvoiceCacheData {
    lastFullSync: string;
    totalInvoices: number;
    dateRanges: {
        [key: string]: {
            startDate: string;
            endDate: string;
            syncTimestamp: number;
            invoiceCount: number;
        };
    };
    invoices: CachedInvoice[];
    metadata: {
        version: string;
        cacheFormat: string;
        lastCleanup: string;
    };
}

export class InvoiceCacheService {
    private static readonly CACHE_FILE_PATH = path.join(process.cwd(), 'invoices_cache.json');
    private static readonly CACHE_VERSION = '1.0.0';
    private static readonly MAX_CACHE_AGE_DAYS = 15; // Datos válidos por 15 días
    private static readonly CLEANUP_INTERVAL_DAYS = 30; // Limpieza cada 30 días
    private static readonly AUTO_UPDATE_INTERVAL_DAYS = 15; // Actualización automática cada 15 días
    private static readonly MAX_PAGES_PER_REQUEST = 50; // Aumentar para cargar más facturas
    private static readonly MAX_INVOICES_TOTAL = 10000; // Permitir más facturas

    private apiKey: string;
    private apiUrl: string;

    constructor(apiKey: string, apiUrl: string) {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
        this.ensureCacheFileExists();

        // Solo iniciar sincronización automática en producción (no en tests)
        if (process.env.NODE_ENV !== 'test') {
            this.initializeAutoSync();
        }
    }    /**
     * Inicializa la sincronización automática de facturas
     */
    private initializeAutoSync(): void {
        console.log('🔄 [CACHE] Inicializando sincronización automática de facturas...');

        // Ejecutar verificación inicial de forma asíncrona sin bloquear constructor
        process.nextTick(async () => {
            try {
                const cacheData = this.loadCacheData();
                const needsInitialLoad = this.shouldPerformFullSync(cacheData);

                if (needsInitialLoad) {
                    console.log('📥 [CACHE] Cargando facturas iniciales desde la API...');
                    await this.performFullSync();
                }
            } catch (error) {
                console.error('❌ [CACHE] Error en sincronización inicial:', error);
            }
        });

        // Configurar actualización automática cada 15 días
        setInterval(async () => {
            try {
                console.log('⏰ [CACHE] Ejecutando sincronización automática programada...');
                await this.performFullSync();
            } catch (error) {
                console.error('❌ [CACHE] Error en sincronización programada:', error);
            }
        }, InvoiceCacheService.AUTO_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    }

    /**
     * Realiza una sincronización completa con la API
     */
    public async performFullSync(): Promise<void> {
        try {
            console.log('🚀 [CACHE] Iniciando sincronización completa con la API de WispHub...');

            // Calcular rango de fechas para los últimos 12 meses
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 12);

            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];

            console.log(`📅 [CACHE] Sincronizando facturas del ${start} al ${end}`);

            // Obtener todas las facturas del período
            const allInvoices = await this.fetchAllInvoicesFromAPI(start, end);

            console.log(`📊 [CACHE] Se obtuvieron ${allInvoices.length} facturas de la API`);

            // Normalizar facturas
            const normalizedInvoices = this.normalizeInvoices(allInvoices);

            // Actualizar caché completamente
            const cacheData: InvoiceCacheData = {
                lastFullSync: new Date().toISOString(),
                totalInvoices: normalizedInvoices.length,
                dateRanges: {
                    [`${start}_${end}`]: {
                        startDate: start,
                        endDate: end,
                        syncTimestamp: Date.now(),
                        invoiceCount: normalizedInvoices.length
                    }
                },
                invoices: normalizedInvoices,
                metadata: {
                    version: InvoiceCacheService.CACHE_VERSION,
                    cacheFormat: 'normalized_invoices_v1',
                    lastCleanup: new Date().toISOString()
                }
            };

            this.saveCacheData(cacheData);
            console.log(`✅ [CACHE] Sincronización completa finalizada. ${normalizedInvoices.length} facturas guardadas.`);

        } catch (error) {
            console.error('❌ [CACHE] Error durante la sincronización completa:', error);
            throw error;
        }
    }    /**
     * Obtiene TODAS las facturas de la API sin límites restrictivos
     */
    private async fetchAllInvoicesFromAPI(startDate: string, endDate: string): Promise<any[]> {
        const allInvoices: any[] = [];
        let nextUrl: string | null = `${this.apiUrl}?fecha_emision_after=${startDate}&fecha_emision_before=${endDate}&limit=300`;
        let page = 1;
        const maxPages = InvoiceCacheService.MAX_PAGES_PER_REQUEST;

        console.log(`📡 [CACHE] Iniciando descarga masiva de facturas desde la API...`);

        try {
            while (nextUrl && page <= maxPages && allInvoices.length < InvoiceCacheService.MAX_INVOICES_TOTAL) {
                console.log(`📄 [CACHE] Descargando página ${page} - Total facturas hasta ahora: ${allInvoices.length}`);

                const response: any = await axios.get(nextUrl, {
                    headers: {
                        'Authorization': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 segundos timeout
                });

                if (response.data && response.data.results) {
                    const pageInvoices = response.data.results;
                    allInvoices.push(...pageInvoices);

                    console.log(`✅ [CACHE] Página ${page} descargada: ${pageInvoices.length} facturas`);

                    // Obtener siguiente página
                    nextUrl = response.data.next;
                    page++;

                    // Pequeña pausa para no sobrecargar la API
                    if (nextUrl) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } else {
                    console.log('⚠️ [CACHE] Respuesta de API sin datos válidos');
                    break;
                }
            }

            if (page > maxPages) {
                console.log(`⚠️ [CACHE] Se alcanzó el límite máximo de páginas (${maxPages})`);
            }

            if (allInvoices.length >= InvoiceCacheService.MAX_INVOICES_TOTAL) {
                console.log(`⚠️ [CACHE] Se alcanzó el límite máximo de facturas (${InvoiceCacheService.MAX_INVOICES_TOTAL})`);
            }

            console.log(`📊 [CACHE] Descarga completa: ${allInvoices.length} facturas obtenidas en ${page - 1} páginas`);
            return allInvoices;

        } catch (error) {
            console.error('❌ [CACHE] Error al obtener facturas de la API:', error);
            throw error;
        }
    }

    /**
     * Verifica si se debe realizar una sincronización completa
     */
    private shouldPerformFullSync(cacheData: InvoiceCacheData): boolean {
        if (!cacheData.lastFullSync) {
            console.log('📋 [CACHE] No hay sincronización previa - se requiere carga inicial');
            return true;
        }

        const lastSync = new Date(cacheData.lastFullSync);
        const now = new Date();
        const daysSinceLastSync = Math.abs((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastSync >= InvoiceCacheService.AUTO_UPDATE_INTERVAL_DAYS) {
            console.log(`📅 [CACHE] Han pasado ${daysSinceLastSync.toFixed(1)} días desde la última sincronización - se requiere actualización`);
            return true;
        }

        if (cacheData.totalInvoices === 0) {
            console.log('📋 [CACHE] Caché vacío - se requiere carga inicial');
            return true;
        }

        console.log(`✅ [CACHE] Caché válido - última sincronización hace ${daysSinceLastSync.toFixed(1)} días`);
        return false;
    }/**
     * Obtiene facturas en un rango de fechas, usando caché local cuando sea posible
     */
    async getInvoicesInDateRange(startDate: string, endDate: string, forceRefresh: boolean = false): Promise<CachedInvoice[]> {
        console.log(`📋 [CACHE] Consultando facturas del ${startDate} al ${endDate}`);

        // Validar que el rango no sea demasiado amplio para evitar bucles infinitos
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffInDays = Math.abs((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays > 365) {
            console.warn(`⚠️ [CACHE] Rango de fechas muy amplio (${diffInDays} días), limitando a últimos 365 días`);
            const limitedStart = new Date(end);
            limitedStart.setDate(limitedStart.getDate() - 365);
            startDate = limitedStart.toISOString().split('T')[0];
        }

        const cacheKey = `${startDate}_${endDate}`;
        const cacheData = this.loadCacheData();

        // Verificar si tenemos datos en caché válidos para este rango
        if (!forceRefresh && this.isCacheValidForRange(cacheData, cacheKey, startDate, endDate)) {
            console.log(`✅ [CACHE] Usando datos en caché para rango ${cacheKey}`);
            return this.getInvoicesFromCache(cacheData, startDate, endDate);
        }

        // Si no hay caché válido, consultar API
        console.log(`📡 [CACHE] Consultando API para rango ${cacheKey}`);
        const apiInvoices = await this.fetchInvoicesFromAPI(startDate, endDate);

        // Normalizar y guardar en caché
        const normalizedInvoices = this.normalizeInvoices(apiInvoices);
        await this.updateCacheWithNewInvoices(cacheData, normalizedInvoices, cacheKey, startDate, endDate);

        return normalizedInvoices;
    }

    /**
     * Método optimizado para consultar facturas de un cliente específico
     */
    async getInvoicesForClientOptimized(serviceId: string, userData: any, monthsBack: number = 6): Promise<CachedInvoice[]> {
        console.log(`🔍 [CACHE] Consultando facturas optimizada para cliente ${serviceId}`);

        // Crear rango de fechas optimizado (últimos N meses)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);

        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        // Asegurar que tenemos facturas para este período
        await this.getInvoicesInDateRange(start, end);

        // Filtrar desde el caché
        return this.getInvoicesForClient(serviceId, userData, { start, end });
    }

    /**
     * Obtiene facturas para un cliente específico desde el caché
     */    getInvoicesForClient(serviceId: string, userData: any, dateRange?: { start: string; end: string }): CachedInvoice[] {
        console.log(`🔍 [CACHE] Filtrando facturas para cliente ${serviceId}`);

        const cacheData = this.loadCacheData();
        let invoices = cacheData.invoices || []; // Asegurarse de que invoices sea un array

        // Filtrar por rango de fechas si se especifica
        if (dateRange) {
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);

            invoices = invoices.filter(invoice => {
                const invoiceDate = new Date(invoice.fecha_emision);
                return invoiceDate >= startDate && invoiceDate <= endDate;
            });
        }

        // Filtrar por cliente
        return this.filterInvoicesForClient(invoices, serviceId, userData);
    }

    /**
     * Actualiza el estado de facturas específicas consultando la API
     * (para obtener información que puede cambiar como el estado de pago)
     */
    async refreshInvoiceStatus(invoiceIds: string[]): Promise<CachedInvoice[]> {
        console.log(`🔄 [CACHE] Actualizando estado de ${invoiceIds.length} facturas`);

        const updatedInvoices: CachedInvoice[] = [];
        const cacheData = this.loadCacheData();

        for (const invoiceId of invoiceIds) {
            try {
                const response = await axios.get(`${this.apiUrl}${invoiceId}/`, {
                    headers: { 'Authorization': this.apiKey }
                });

                const normalizedInvoice = this.normalizeInvoice(response.data);
                updatedInvoices.push(normalizedInvoice);

                // Actualizar en caché
                const index = cacheData.invoices.findIndex(inv => inv.id === invoiceId);
                if (index !== -1) {
                    cacheData.invoices[index] = normalizedInvoice;
                }
            } catch (error) {
                console.error(`❌ [CACHE] Error actualizando factura ${invoiceId}:`, error);
            }
        }

        // Guardar cambios
        this.saveCacheData(cacheData);
        return updatedInvoices;
    }

    /**
     * Limpia el caché eliminando datos antiguos
     */
    async cleanupCache(): Promise<void> {
        console.log(`🧹 [CACHE] Iniciando limpieza de caché`);

        const cacheData = this.loadCacheData();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - InvoiceCacheService.MAX_CACHE_AGE_DAYS);

        // Eliminar facturas antiguas
        const initialCount = cacheData.invoices.length;
        cacheData.invoices = cacheData.invoices.filter(invoice =>
            new Date(invoice.lastUpdated) > cutoffDate
        );        // Eliminar rangos de fechas antiguos
        Object.keys(cacheData.dateRanges).forEach(key => {
            const range = cacheData.dateRanges[key];
            if (range.syncTimestamp < cutoffDate.getTime()) {
                delete cacheData.dateRanges[key];
            }
        });

        // Actualizar metadatos
        cacheData.metadata.lastCleanup = new Date().toISOString();
        cacheData.totalInvoices = cacheData.invoices.length;

        this.saveCacheData(cacheData);

        console.log(`✅ [CACHE] Limpieza completada: ${initialCount - cacheData.invoices.length} facturas eliminadas`);
    }

    /**
     * Obtiene estadísticas del caché
     */
    getCacheStats(): any {
        const cacheData = this.loadCacheData();
        const fileStats = fs.statSync(InvoiceCacheService.CACHE_FILE_PATH);

        return {
            totalInvoices: cacheData.totalInvoices,
            lastFullSync: cacheData.lastFullSync,
            dateRangesCached: Object.keys(cacheData.dateRanges).length,
            fileSizeKB: Math.round(fileStats.size / 1024),
            cacheVersion: cacheData.metadata.version,
            lastCleanup: cacheData.metadata.lastCleanup
        };
    }

    /**
     * Verifica si el caché es válido para un rango específico
     */
    private isCacheValidForRange(cacheData: InvoiceCacheData, cacheKey: string, startDate: string, endDate: string): boolean {
        const range = cacheData.dateRanges[cacheKey];
        if (!range) return false;

        const maxAge = InvoiceCacheService.MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
        const isRecent = (Date.now() - range.syncTimestamp) < maxAge;
        const hasCorrectRange = range.startDate === startDate && range.endDate === endDate;

        return isRecent && hasCorrectRange;
    }

    /**
     * Obtiene facturas del caché para un rango específico
     */
    private getInvoicesFromCache(cacheData: InvoiceCacheData, startDate: string, endDate: string): CachedInvoice[] {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return cacheData.invoices.filter(invoice => {
            const invoiceDate = new Date(invoice.fecha_emision);
            return invoiceDate >= start && invoiceDate <= end;
        });
    }    /**
     * Consulta facturas desde la API de WispHub
     */
    private async fetchInvoicesFromAPI(startDate: string, endDate: string): Promise<any[]> {
        console.log(`🔄 [API] Consultando facturas entre ${startDate} y ${endDate}`);

        const allInvoices: any[] = [];
        let page = 1;
        let hasNextPage = true;
        const maxPages = 10; // Límite reducido para evitar bucles infinitos
        const maxInvoices = 2000; // Límite máximo de facturas por rango

        while (hasNextPage && page <= maxPages && allInvoices.length < maxInvoices) {
            try {
                console.log(`📄 [API] Solicitando página ${page}...`); const params = {
                    limit: 200,
                    fecha_emision_after: startDate,
                    fecha_emision_before: endDate,
                    ordering: '-fecha_emision',
                    page
                }; const response = await axios.get(this.apiUrl, {
                    params,
                    headers: { 'Authorization': this.apiKey }
                });

                const { results, next, count } = response.data;

                console.log(`📄 [API] Página ${page}: ${results?.length || 0} facturas obtenidas`);

                // Verificar si hay resultados
                if (!results || results.length === 0) {
                    console.log(`📋 [API] No hay más resultados, finalizando`);
                    break;
                }

                allInvoices.push(...results);

                // Condiciones de terminación más estrictas
                if (!next || results.length < 200) {
                    console.log(`📋 [API] Última página alcanzada (${results.length} resultados), finalizando`);
                    break;
                }

                // Si el conteo total está disponible, verificar progreso
                if (count && allInvoices.length >= count) {
                    console.log(`📋 [API] Todas las facturas obtenidas (${allInvoices.length}/${count})`);
                    break;
                }

                hasNextPage = !!next;
                page++;

                // Pequeña pausa entre solicitudes para evitar sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error: any) {
                console.error(`❌ [API] Error en página ${page}:`, error?.message || error);

                // Si es un error 404 o similar, detener
                if (error?.response?.status >= 400) {
                    console.log(`❌ [API] Error HTTP ${error.response.status}, deteniendo consulta`);
                    break;
                }
                break;
            }
        }

        // Mostrar advertencias si se alcanzaron límites
        if (page > maxPages) {
            console.warn(`⚠️ [API] Se alcanzó el límite máximo de páginas (${maxPages}). Facturas obtenidas: ${allInvoices.length}`);
        }

        if (allInvoices.length >= maxInvoices) {
            console.warn(`⚠️ [API] Se alcanzó el límite máximo de facturas (${maxInvoices}) para este rango`);
        }

        console.log(`📊 [API] Total obtenido: ${allInvoices.length} facturas para el rango ${startDate} - ${endDate}`);
        return allInvoices;
    }

    /**
     * Normaliza múltiples facturas
     */
    private normalizeInvoices(invoices: any[]): CachedInvoice[] {
        return invoices.map(invoice => this.normalizeInvoice(invoice));
    }

    /**
     * Normaliza una factura individual
     */
    private normalizeInvoice(invoice: any): CachedInvoice {
        // Extraer monto
        let amount = 0;
        if (invoice.total && !isNaN(parseFloat(invoice.total))) amount = parseFloat(invoice.total);
        else if (invoice.valor && !isNaN(parseFloat(invoice.valor))) amount = parseFloat(invoice.valor);
        else if (invoice.monto && !isNaN(parseFloat(invoice.monto))) amount = parseFloat(invoice.monto);
        else if (invoice.amount && !isNaN(parseFloat(invoice.amount))) amount = parseFloat(invoice.amount);

        // Extraer fecha de vencimiento
        let dueDate = new Date();
        if (invoice.fecha_vencimiento) {
            dueDate = new Date(invoice.fecha_vencimiento);
        } else if (invoice.fecha_emision) {
            dueDate = new Date(invoice.fecha_emision);
            dueDate.setDate(dueDate.getDate() + 30); // Asumir 30 días de plazo
        } return {
            id: invoice.id_factura || invoice.id || invoice.numero || `INV-${Date.now()}`,
            numero: invoice.numero || invoice.id_factura || invoice.folio,
            amount: amount,
            monto: amount,
            dueDate: dueDate,
            fecha_vencimiento: dueDate.toISOString(),
            fecha_emision: invoice.fecha_emision || new Date().toISOString(),
            status: invoice.estado || invoice.status || 'pendiente',
            estado: invoice.estado || invoice.status || 'pendiente',
            cliente: {
                usuario: invoice.cliente?.usuario,
                cedula: invoice.cliente?.cedula,
                telefono: invoice.cliente?.telefono,
                nombre: invoice.cliente?.nombre,
                id: invoice.cliente?.id
            },
            originalData: invoice,
            cacheTimestamp: Date.now(),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Actualiza el caché con nuevas facturas
     */
    private async updateCacheWithNewInvoices(
        cacheData: InvoiceCacheData,
        newInvoices: CachedInvoice[],
        cacheKey: string,
        startDate: string,
        endDate: string
    ): Promise<void> {
        // Eliminar facturas del mismo rango que ya estén en caché
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        cacheData.invoices = cacheData.invoices.filter(invoice => {
            const invoiceDate = new Date(invoice.fecha_emision);
            return !(invoiceDate >= startDateObj && invoiceDate <= endDateObj);
        });

        // Agregar nuevas facturas
        cacheData.invoices.push(...newInvoices);

        // Actualizar metadatos del rango
        cacheData.dateRanges[cacheKey] = {
            startDate,
            endDate,
            syncTimestamp: Date.now(),
            invoiceCount: newInvoices.length
        };

        // Actualizar metadatos generales
        cacheData.lastFullSync = new Date().toISOString();
        cacheData.totalInvoices = cacheData.invoices.length;

        this.saveCacheData(cacheData);
        console.log(`💾 [CACHE] Guardadas ${newInvoices.length} facturas en caché`);
    }    /**
     * Filtra facturas para un cliente específico
     */
    private filterInvoicesForClient(invoices: CachedInvoice[], serviceId: string, userData: any): CachedInvoice[] {
        const filteredInvoices = invoices.filter(invoice => {
            const clientData = invoice.cliente;
            if (!clientData) return false;

            // Coincidencia por usuario (ID de servicio)
            if (clientData.usuario) {
                const normalizedUser = clientData.usuario.toLowerCase();
                if (
                    normalizedUser.includes(`-${serviceId}@`) ||
                    normalizedUser.includes(`-${serviceId}-`) ||
                    normalizedUser.includes(`${serviceId.toString().padStart(4, '0')}`) ||
                    normalizedUser === serviceId.toString()
                ) {
                    return true;
                }
            }

            // Coincidencia por cédula
            if (userData?.cedula && clientData.cedula &&
                userData.cedula.toString() === clientData.cedula.toString()) {
                return true;
            }

            // Coincidencia por teléfono
            if (clientData.telefono && clientData.telefono.includes(serviceId.toString())) {
                return true;
            }            // Coincidencia por nombre
            if (userData?.customerName && clientData.nombre &&
                typeof userData.customerName === 'string' &&
                (clientData.nombre.toLowerCase().includes(userData.customerName.toLowerCase()) ||
                    userData.customerName.toLowerCase().includes(clientData.nombre.toLowerCase()))) {
                return true;
            }

            return false;
        });

        // Deduplicar facturas por ID
        const uniqueInvoices = filteredInvoices.reduce((acc, current) => {
            const isDuplicate = acc.find(invoice =>
                invoice.id === current.id ||
                (invoice.originalData?.id_factura && current.originalData?.id_factura &&
                    invoice.originalData.id_factura === current.originalData.id_factura)
            );

            if (!isDuplicate) {
                acc.push(current);
            }
            return acc;
        }, [] as CachedInvoice[]);

        // Ordenar por fecha de emisión más reciente
        return uniqueInvoices.sort((a, b) =>
            new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime()
        );
    }

    /**
     * Carga los datos del caché desde el archivo JSON
     */    private loadCacheData(): InvoiceCacheData {
        try {
            if (!fs.existsSync(InvoiceCacheService.CACHE_FILE_PATH)) {
                console.log(`📋 [CACHE] Archivo no existe, creando nuevo caché`);
                const emptyData = this.createEmptyCacheData();
                this.saveCacheData(emptyData);
                return emptyData;
            }

            const data = fs.readFileSync(InvoiceCacheService.CACHE_FILE_PATH, 'utf8');
            if (!data.trim()) {
                console.log(`📋 [CACHE] Archivo vacío, creando nuevo caché`);
                const emptyData = this.createEmptyCacheData();
                this.saveCacheData(emptyData);
                return emptyData;
            }

            const parsedData = JSON.parse(data);
            // Asegurar que tenga la estructura correcta
            if (!parsedData.invoices) {
                parsedData.invoices = [];
            }
            if (!parsedData.dateRanges) {
                parsedData.dateRanges = {};
            }
            return parsedData;
        } catch (error) {
            console.log(`📋 [CACHE] Error leyendo caché, creando nuevo:`, error);
            const emptyData = this.createEmptyCacheData();
            this.saveCacheData(emptyData);
            return emptyData;
        }
    }

    /**
     * Guarda los datos del caché en el archivo JSON
     */
    private saveCacheData(data: InvoiceCacheData): void {
        try {
            fs.writeFileSync(InvoiceCacheService.CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error(`❌ [CACHE] Error guardando caché:`, error);
        }
    }

    /**
     * Asegura que el archivo de caché exista
     */    private ensureCacheFileExists(): void {
        if (!fs.existsSync(InvoiceCacheService.CACHE_FILE_PATH)) {
            const emptyData = this.createEmptyCacheData();
            this.saveCacheData(emptyData);
            console.log(`📋 [CACHE] Archivo de caché creado: ${InvoiceCacheService.CACHE_FILE_PATH}`);
        } else {
            // Verificar que el archivo no esté vacío
            try {
                const data = fs.readFileSync(InvoiceCacheService.CACHE_FILE_PATH, 'utf8');
                if (!data.trim()) {
                    const emptyData = this.createEmptyCacheData();
                    this.saveCacheData(emptyData);
                    console.log(`📋 [CACHE] Archivo vacío reparado: ${InvoiceCacheService.CACHE_FILE_PATH}`);
                }
            } catch (error) {
                const emptyData = this.createEmptyCacheData();
                this.saveCacheData(emptyData);
                console.log(`📋 [CACHE] Archivo corrupto reparado: ${InvoiceCacheService.CACHE_FILE_PATH}`);
            }
        }
    }

    /**
     * Crea una estructura de caché vacía
     */
    private createEmptyCacheData(): InvoiceCacheData {
        return {
            lastFullSync: '',
            totalInvoices: 0,
            dateRanges: {},
            invoices: [],
            metadata: {
                version: InvoiceCacheService.CACHE_VERSION,
                cacheFormat: 'normalized_invoices_v1',
                lastCleanup: new Date().toISOString()
            }
        };
    }
}

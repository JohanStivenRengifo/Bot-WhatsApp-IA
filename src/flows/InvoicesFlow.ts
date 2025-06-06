import axios from 'axios';
import { SessionData } from '../interfaces/WhatsAppMessage';
import { User } from '../interfaces/User';
import { MessageService } from '../services/MessageService';
import { CustomerService } from '../services/CustomerService';
import { SecurityService } from '../services/SecurityService';
import { BaseConversationFlow } from './ConversationFlow';
import { Invoice } from '../interfaces/Invoice';
import { InvoiceCacheService, CachedInvoice } from '../services/InvoiceCacheService';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

interface InvoicesSession extends SessionData {
    consultingInvoices?: boolean;
    invoicesCache?: {
        [serviceId: string]: {
            invoices: any[];
            timestamp: number;
        };
    };
}

export class InvoicesFlow extends BaseConversationFlow {
    readonly name: string = 'invoices';
    private customerService: CustomerService;
    private invoiceCacheService: InvoiceCacheService;
    private apiKey: string;
    private apiUrl: string;
    private cacheDuration: number = 30 * 60 * 1000; // 30 minutos en milisegundos

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;

        // Configurar API key y URL directamente para garantizar conexión correcta
        this.apiKey = 'Api-Key mHHsEQKX.Uc1BQzXFOCXUno64ZTM9K4vaDPjH9gLq';
        this.apiUrl = 'https://api.wisphub.app/api/facturas/';

        // Inicializar servicio de caché
        this.invoiceCacheService = new InvoiceCacheService(this.apiKey, this.apiUrl);
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        // Verificar si el usuario está autenticado
        if (!user.authenticated) {
            return false;
        }

        // Verificar si el usuario está consultando facturas o solicitando sincronización
        return (
            session.consultingInvoices === true ||
            extractedCommand === 'factura' ||
            isMenuCommand(message, ['factura', 'facturas', 'mi factura', 'mis facturas',
                'consultar factura', 'consultar facturas', 'actualizar facturas',
                'sincronizar facturas', 'cargar facturas'])
        );
    }    /**
     * Maneja el mensaje del usuario
     */
    async handle(user: User, message: string, session: InvoicesSession): Promise<boolean> {
        try {            // Extraer comando del mensaje
            const extractedCommand = extractMenuCommand(message);

            // Verificar si es comando de sincronización manual
            if (isMenuCommand(message, ['actualizar facturas', 'sincronizar facturas', 'cargar facturas'])) {
                await this.handleSyncCommand(user);
                return true;
            }

            // Verificar si el usuario quiere volver al menú principal
            if (extractedCommand === 'menu') {
                session.consultingInvoices = false;
                session.flowActive = '';
                await this.messageService.sendMainMenu(user.phoneNumber);
                return true;
            }

            // Verificar si el usuario quiere contactar soporte
            if (extractedCommand === 'ticket') {
                session.consultingInvoices = false;
                session.flowActive = '';
                // Permitir que TicketCreationFlow maneje esto
                return false;
            }

            // Marcar que el usuario está consultando facturas
            session.consultingInvoices = true;
            session.flowActive = 'invoices';

            // Enviar mensaje de espera
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '📄 Consultando tu estado de cuenta y facturas...\n\n⏳ Un momento, por favor.'
            );

            // Obtener el ID de servicio del usuario
            const serviceId = this.getServiceId(user);
            console.log(`🔍 [DEBUG] Iniciando consulta de facturas para cliente ${serviceId}`);

            if (!serviceId) {
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '❌ No se pudo identificar tu servicio. Por favor, contacta a soporte.'
                );
                session.consultingInvoices = false;
                session.flowActive = '';
                return true;
            }

            // Consultar facturas usando el servicio de caché optimizado
            const invoices = await this.getInvoicesWithCache(serviceId, session, user);

            if (!invoices || invoices.length === 0) {
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '📋 No se encontraron facturas asociadas a tu cuenta.'
                );
                session.consultingInvoices = false;
                session.flowActive = '';
                return true;
            }

            // Mostrar las facturas ordenadas por fecha de vencimiento
            const sortedInvoices = this.sortInvoicesByDueDate(invoices);
            await this.showInvoicesSummary(user.phoneNumber, sortedInvoices);

            session.consultingInvoices = false;
            session.flowActive = '';
            return true;

        } catch (error) {
            console.error('❌ Error en InvoicesFlow:', error);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Hubo un error al consultar las facturas. Intenta nuevamente.'
            );
            session.consultingInvoices = false;
            session.flowActive = '';
            return true;
        }
    }

    /**
     * Obtiene el ID de servicio del usuario
     */
    private getServiceId(user: User): string | null {
        // Método 1: Usar customerId directamente
        if (user.customerId) {
            return user.customerId;
        }

        // Método 2: Usar userServices
        if (user.userServices && user.userServices.length > 0) {
            return user.userServices[0].id;
        }

        // Método 3: Extraer de los datos encriptados
        if (user.encryptedData) {
            try {
                const decodedData = this.decodeUserData(user);
                if (decodedData?.serviceId) {
                    return decodedData.serviceId;
                }
            } catch (error) {
                console.error('Error decodificando datos del usuario:', error);
            }
        }

        return null;
    }

    /**
     * Obtiene las facturas usando el servicio de caché optimizado
     */
    private async getInvoicesWithCache(
        serviceId: string | null,
        session: InvoicesSession,
        user: User
    ): Promise<any[]> {
        if (!serviceId) return [];

        console.log(`🔍 [INVOICES] Consultando facturas para servicio ${serviceId} con caché optimizado`);

        try {
            // Extraer datos del usuario para filtrado
            const userData = this.extractUserData(user);            // Usar el método optimizado del servicio de caché (últimos 6 meses por defecto)
            const clientInvoices = await this.invoiceCacheService.getInvoicesForClientOptimized(
                serviceId,
                userData,
                6 // monthsBack: consultar últimos 6 meses
            );

            console.log(`✅ [INVOICES] ${clientInvoices.length} facturas encontradas para cliente ${serviceId}`);
            return clientInvoices;

        } catch (error) {
            console.error(`❌ Error al obtener facturas con caché para ${serviceId}:`, error);

            // Fallback: intentar obtener del caché local sin actualización
            try {
                const userData = this.extractUserData(user);
                const fallbackInvoices = this.invoiceCacheService.getInvoicesForClient(serviceId, userData);
                console.log(`🔄 [FALLBACK] ${fallbackInvoices.length} facturas encontradas en caché local`);
                return fallbackInvoices;
            } catch (fallbackError) {
                console.error('❌ Error en fallback:', fallbackError);
                return [];
            }
        }
    }

    /**
     * Consulta todas las facturas desde la API
     */
    private async fetchAllInvoicesFromAPI(serviceId: string | null, user: User): Promise<any[]> {
        if (!serviceId) return [];

        console.log(`🔍 Obteniendo facturas para cliente: ${serviceId}`);

        // Extraer datos del usuario para filtrado posterior
        const userData = this.extractUserData(user);
        console.log(`👤 Datos de usuario disponibles: ${JSON.stringify(userData)}`);

        // Calcular rango de fechas (últimos 3 meses)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);

        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];

        console.log(`📅 Consultando facturas desde ${formattedStartDate} hasta ${formattedEndDate}`);

        // Resultados acumulados y control de paginación
        const allInvoices: any[] = [];
        let page = 1;
        let hasNextPage = true;

        // Consultar todas las páginas
        while (hasNextPage) {
            console.log(`📡 Solicitando página ${page} de facturas...`);

            try {
                // Construir URL con parámetros
                const params = {
                    limit: 200,
                    fecha_emision__range_0: formattedStartDate,
                    fecha_emision__range_1: formattedEndDate,
                    ordering: '-fecha_emision'
                };

                // Realizar petición a la API
                const response = await axios.get(this.apiUrl, {
                    params: {
                        ...params,
                        page
                    },
                    headers: {
                        'Authorization': this.apiKey
                    }
                });

                const { results, count, next } = response.data;

                console.log(`🔍 [DEBUG] Respuesta recibida: { totalResults: ${count}, resultsInPage: ${results.length}, hasNext: ${!!next} }`);

                // Depurar estructura de resultados
                if (results && results.length > 0) {
                    console.log(`🔍 [DEBUG] Estructura de la primera factura:`, JSON.stringify(results[0], null, 2));

                    // Verificar campos específicos
                    const sampleInvoice = results[0];
                    console.log(`🔍 [DEBUG] Campos disponibles:`, Object.keys(sampleInvoice));

                    // Verificar campos de monto
                    console.log(`💲 [DEBUG] Campos de monto:`, {
                        valor: sampleInvoice.valor,
                        monto: sampleInvoice.monto,
                        amount: sampleInvoice.amount,
                        value: sampleInvoice.value,
                        total: sampleInvoice.total
                    });

                    // Verificar campos de fecha
                    console.log(`📅 [DEBUG] Campos de fecha:`, {
                        fecha_vencimiento: sampleInvoice.fecha_vencimiento,
                        dueDate: sampleInvoice.dueDate,
                        vencimiento: sampleInvoice.vencimiento,
                        fecha_emision: sampleInvoice.fecha_emision
                    });

                    // Verificar estructura de cliente
                    if (sampleInvoice.cliente) {
                        console.log(`👤 [DEBUG] Estructura de cliente:`, JSON.stringify(sampleInvoice.cliente, null, 2));
                    }
                }

                // Filtrar facturas para este cliente
                const filteredInvoices = this.filterInvoicesForClient(results, serviceId, userData);

                // Normalizar los datos de las facturas
                const normalizedInvoices = filteredInvoices.map(invoice => {
                    console.log(`🧾 [DEBUG] Normalizando factura:`, JSON.stringify(invoice, null, 2));

                    // Extraer monto - verificar todos los campos posibles y convertir a número
                    let amount = 0;
                    if (invoice.total && !isNaN(parseFloat(invoice.total))) amount = parseFloat(invoice.total);
                    else if (invoice.valor && !isNaN(parseFloat(invoice.valor))) amount = parseFloat(invoice.valor);
                    else if (invoice.monto && !isNaN(parseFloat(invoice.monto))) amount = parseFloat(invoice.monto);
                    else if (invoice.amount && !isNaN(parseFloat(invoice.amount))) amount = parseFloat(invoice.amount);
                    else if (invoice.value && !isNaN(parseFloat(invoice.value))) amount = parseFloat(invoice.value);

                    console.log(`💲 [DEBUG] Monto extraído: ${amount} de campos:`, {
                        total: invoice.total,
                        valor: invoice.valor,
                        monto: invoice.monto,
                        amount: invoice.amount,
                        value: invoice.value
                    });

                    // Extraer fecha de vencimiento - verificar formato y validez
                    let dueDate = null;
                    let dueDateSource = '';

                    // Intentar extraer fecha de varios campos posibles
                    if (invoice.fecha_vencimiento) {
                        dueDate = new Date(invoice.fecha_vencimiento);
                        dueDateSource = 'fecha_vencimiento';
                    } else if (invoice.dueDate) {
                        dueDate = new Date(invoice.dueDate);
                        dueDateSource = 'dueDate';
                    } else if (invoice.vencimiento) {
                        dueDate = new Date(invoice.vencimiento);
                        dueDateSource = 'vencimiento';
                    } else if (invoice.fecha_emision) {
                        // Si no hay fecha de vencimiento, usar fecha de emisión + 30 días
                        const emissionDate = new Date(invoice.fecha_emision);
                        dueDate = new Date(emissionDate);
                        dueDate.setDate(dueDate.getDate() + 30); // Asumir 30 días de plazo
                        dueDateSource = 'fecha_emision+30';
                    }

                    // Verificar si la fecha es válida
                    if (!dueDate || isNaN(dueDate.getTime())) {
                        console.log(`⚠️ [DEBUG] Fecha inválida, usando fecha actual + 30 días`);
                        dueDate = new Date();
                        dueDate.setDate(dueDate.getDate() + 30);
                        dueDateSource = 'fallback';
                    }

                    console.log(`📅 [DEBUG] Fecha extraída: ${dueDate.toISOString()} de campo: ${dueDateSource}`);

                    // Normalizar estado
                    let status = invoice.estado || invoice.status || 'pendiente';

                    // Crear objeto normalizado
                    const normalizedInvoice = {
                        ...invoice,
                        id: invoice.id || invoice.numero || 'N/A',
                        amount: amount,
                        monto: amount,
                        dueDate: dueDate,
                        fecha_vencimiento: dueDate.toISOString(),
                        status: status,
                        estado: status
                    };

                    console.log(`✅ [DEBUG] Factura normalizada:`, JSON.stringify({
                        id: normalizedInvoice.id,
                        amount: normalizedInvoice.amount,
                        dueDate: normalizedInvoice.dueDate,
                        status: normalizedInvoice.status
                    }, null, 2));

                    return normalizedInvoice;
                });

                allInvoices.push(...normalizedInvoices);

                // Verificar si hay más páginas
                hasNextPage = !!next;
                page++;

                console.log(`📄 Página ${page - 1}: ${filteredInvoices.length} facturas del cliente ${serviceId} de ${results.length} totales`);

                // Si ya tenemos suficientes facturas, detener
                if (allInvoices.length >= 10) {
                    break;
                }
            } catch (error) {
                console.error(`Error al consultar facturas (página ${page}):`, error);
                break;
            }
        }

        // Depurar facturas finales
        console.log(`📊 [DEBUG] Total de facturas encontradas: ${allInvoices.length}`);
        if (allInvoices.length > 0) {
            console.log(`📊 [DEBUG] Primera factura normalizada:`, JSON.stringify(allInvoices[0], null, 2));
        }

        return allInvoices;
    }

    /**
     * Consulta las facturas recientes desde la API
     */
    private async fetchRecentInvoicesFromAPI(serviceId: string | null, user: User): Promise<any[]> {
        if (!serviceId) return [];

        console.log(`🔍 Obteniendo facturas recientes para cliente: ${serviceId}`);

        // Extraer datos del usuario para filtrado posterior
        const userData = this.extractUserData(user);

        // Calcular rango de fechas (último mes)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];

        try {
            // Construir URL con parámetros
            const params = {
                limit: 100,
                fecha_emision__range_0: formattedStartDate,
                fecha_emision__range_1: formattedEndDate,
                ordering: '-fecha_emision'
            };

            // Realizar petición a la API
            const response = await axios.get(this.apiUrl, {
                params,
                headers: {
                    'Authorization': this.apiKey
                }
            });

            const { results } = response.data;

            // Filtrar facturas para este cliente
            return this.filterInvoicesForClient(results, serviceId, userData);
        } catch (error) {
            console.error('Error al consultar facturas recientes:', error);
            return [];
        }
    }

    /**
     * Filtra las facturas para un cliente específico
     */
    private filterInvoicesForClient(invoices: any[], serviceId: string, userData: any): any[] {
        if (!serviceId || !invoices || invoices.length === 0) return [];

        console.log(`🔍 [FILTRADO] Filtrando facturas para cliente: ${serviceId}`);
        console.log(`👤 [FILTRADO] Datos de cliente: ID=${serviceId}, Nombre=${userData?.customerName || ''}, Cédula=${userData?.cedula || ''}`);
        console.log(`📊 [FILTRADO] Total de facturas a filtrar: ${invoices.length}`);

        // Mostrar estructura de algunos clientes para depuración
        for (let i = 0; i < Math.min(3, invoices.length); i++) {
            const invoice = invoices[i];
            if (invoice && invoice.cliente) {
                const clientData = invoice.cliente;
                console.log(`🔍 [FILTRADO] Muestra de estructura de cliente: ${JSON.stringify({
                    type: typeof clientData,
                    keys: Object.keys(clientData),
                    usuario: clientData.usuario,
                    cedula: clientData.cedula,
                    telefono: clientData.telefono,
                    nombre: clientData.nombre
                }, null, 2)}`);
            }
        }

        // Filtrar facturas que coincidan con este cliente
        const filteredInvoices = invoices.filter(invoice => {
            if (!invoice || !invoice.cliente) return false;

            const clientData = invoice.cliente;

            // Intentar coincidir por usuario (ID de servicio)
            if (clientData.usuario) {
                // Normalizar el formato del usuario para comparación
                const normalizedUser = clientData.usuario.toLowerCase();

                // Verificar si contiene el ID de servicio en diferentes formatos
                if (
                    normalizedUser.includes(`-${serviceId}@`) || // formato: xxxx-ID@dominio
                    normalizedUser.includes(`-${serviceId}-`) || // formato: xxxx-ID-xxxx
                    normalizedUser.includes(`${serviceId.toString().padStart(4, '0')}`) || // formato con padding
                    normalizedUser === serviceId.toString() // coincidencia exacta
                ) {
                    console.log(`✅ [FILTRADO] Factura ${invoice.id} coincide para cliente ${serviceId}\n   - Coincidencia por usuario: ${clientData.usuario}`);
                    return true;
                }
            }

            // Coincidir por cédula si está disponible
            if (userData?.cedula && clientData.cedula &&
                userData.cedula.toString() === clientData.cedula.toString()) {
                console.log(`✅ [FILTRADO] Factura ${invoice.id} coincide para cliente ${serviceId}\n   - Coincidencia por cédula: ${clientData.cedula}`);
                return true;
            }

            // Coincidir por teléfono si está disponible
            if (clientData.telefono && clientData.telefono.includes(serviceId.toString())) {
                console.log(`✅ [FILTRADO] Factura ${invoice.id} coincide para cliente ${serviceId}\n   - Coincidencia por teléfono: ${clientData.telefono}`);
                return true;
            }            // Coincidir por nombre si está disponible (coincidencia parcial)
            if (userData?.customerName && clientData.nombre &&
                typeof userData.customerName === 'string' &&
                (clientData.nombre.toLowerCase().includes(userData.customerName.toLowerCase()) ||
                    userData.customerName.toLowerCase().includes(clientData.nombre.toLowerCase()))) {
                console.log(`✅ [FILTRADO] Factura ${invoice.id} coincide para cliente ${serviceId}\n   - Coincidencia por nombre: ${clientData.nombre}`);
                return true;
            }

            return false;
        });

        console.log(`📊 [FILTRADO] Resultado: ${filteredInvoices.length} facturas filtradas de ${invoices.length} totales`);

        // Si no se encontraron facturas, mostrar información de depuración
        if (filteredInvoices.length === 0 && invoices.length > 0) {
            const sampleClients = invoices.slice(0, 5).map(inv => ({
                id_factura: inv.id,
                cliente_usuario: inv.cliente?.usuario,
                cliente_cedula: inv.cliente?.cedula,
                cliente_telefono: inv.cliente?.telefono
            }));
            console.log(`⚠️ [FILTRADO] No se encontraron facturas para ${serviceId}. Muestra de clientes disponibles: ${JSON.stringify(sampleClients, null, 2)}`);
        }

        return filteredInvoices;
    }

    /**
     * Ordena las facturas por fecha de vencimiento
     */
    private sortInvoicesByDueDate(invoices: any[]): any[] {
        return invoices.sort((a, b) => {
            const dateA = new Date(a.fecha_vencimiento || a.dueDate);
            const dateB = new Date(b.fecha_vencimiento || b.dueDate);
            return dateA.getTime() - dateB.getTime();
        });
    }

    /**
     * Muestra un resumen de las facturas del usuario
     */
    private async showInvoicesSummary(phoneNumber: string, invoices: any[]): Promise<void> {
        console.log(`🔍 [DEBUG] Estructura de facturas recibidas:`);
        invoices.slice(0, 2).forEach((invoice, i) => {
            console.log(`📄 [DEBUG] Factura ${i + 1}:`, JSON.stringify(invoice, null, 2));
        });

        const formatCurrency = (amount: number | string | any): string => {
            if (typeof amount === 'string') amount = parseFloat(amount) || 0;
            if (typeof amount !== 'number') amount = 0;
            return `$${amount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        };

        const formatDate = (dateStr: string | Date | any): string => {
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch {
                return 'Fecha no disponible';
            }
        };

        let message = '📄 *TUS FACTURAS*\n\n';

        // Mostrar máximo 5 facturas
        const recentInvoices = invoices.slice(0, 5);

        if (recentInvoices.length > 0) {
            recentInvoices.forEach((invoice, index) => {
                // Intentar obtener información relevante de la factura
                const amount = invoice.monto || invoice.amount || invoice.total || invoice.valor || 0;
                const dueDate = invoice.fecha_vencimiento || invoice.dueDate || invoice.fecha_emision;
                const status = invoice.estado || invoice.status || 'N/A';
                const isPaid = status.toLowerCase().includes('pagad') || status.toLowerCase().includes('paid');
                const statusEmoji = isPaid ? '✅' : '⚠️';

                message += `${statusEmoji} *Factura #${invoice.id || index + 1}*\n`;
                message += `💰 Monto: ${formatCurrency(amount)}\n`;
                message += `📅 Vence: ${formatDate(dueDate)}\n`;
                message += `🔄 Estado: ${isPaid ? 'Pagada' : 'Pendiente'}\n\n`;
            }); await this.messageService.sendTextMessage(phoneNumber, message);

            // Usar el método estándar de navegación para mostrar opciones
            await this.messageService.sendNavigationButtons(
                phoneNumber,
                '📄 Facturas',
                '¿Qué deseas hacer ahora?'
            );

        } else {
            message += '❌ No se encontraron facturas recientes.\n';
            message += 'Si crees que esto es un error, contacta a soporte.';

            await this.messageService.sendTextMessage(phoneNumber, message);

            // Usar el método estándar de navegación para mostrar opciones
            await this.messageService.sendNavigationButtons(
                phoneNumber,
                '📄 Facturas',
                '¿Qué deseas hacer ahora?'
            );
        }
    }

    /**
     * Extrae datos relevantes del usuario para filtrado
     */
    private extractUserData(user: User): any {
        const result: any = {};

        // Obtener datos de userServices
        if (user.userServices && user.userServices.length > 0) {
            result.serviceId = user.userServices[0].id;
            result.customerName = user.userServices[0].name;
        }        // Si no hay nombre, intentar obtenerlo de datos encriptados
        if (!result.customerName && user.encryptedData) {
            try {
                const decodedData = this.extractEncryptedUserData(user);
                if (decodedData?.customerName) {
                    result.customerName = decodedData.customerName;
                }
                if (decodedData?.cedula) {
                    result.cedula = decodedData.cedula;
                }
            } catch (error) {
                console.log('Error decodificando datos del usuario:', error);
            }
        }

        // Usar customerId como fallback para serviceId
        if (!result.serviceId && user.customerId) {
            result.serviceId = user.customerId;
        }

        return result;
    }    /**
     * Extrae datos de los datos encriptados del usuario
     */
    private extractEncryptedUserData(user: User): any {
        try {
            if (user.encryptedData) {
                const decryptedString = this.securityService.decryptSensitiveData(user.encryptedData);
                return JSON.parse(decryptedString);
            }
        } catch (error) {
            console.error('Error al extraer datos encriptados del usuario:', error);
        }
        return null;
    }

    /**
     * Maneja comandos de sincronización manual
     */
    private async handleSyncCommand(user: User): Promise<void> {
        try {
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '🔄 Iniciando sincronización manual de facturas...\n\n📥 Descargando todas las facturas desde WispHub...\n⏳ Este proceso puede tomar unos minutos.'
            );

            // Ejecutar sincronización completa
            await this.invoiceCacheService.performFullSync();

            // Obtener estadísticas del caché actualizado
            const stats = this.invoiceCacheService.getCacheStats(); await this.messageService.sendTextMessage(
                user.phoneNumber,
                `✅ Sincronización completada exitosamente!\n\n📊 Estadísticas:\n• Total de facturas: ${stats.totalInvoices}\n• Última actualización: ${new Date().toLocaleString('es-ES')}\n• Próxima sincronización automática: En 15 días\n\n💡 Ya puedes consultar tus facturas escribiendo "facturas"`
            );

            // Mostrar botones de navegación
            await this.messageService.sendNavigationButtons(
                user.phoneNumber,
                '🔄 Sincronización',
                '¿Qué deseas hacer ahora?'
            );

        } catch (error) {
            console.error('Error durante sincronización manual:', error);

            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Error durante la sincronización de facturas.\n\nPor favor, inténtalo más tarde o contacta a soporte técnico.'
            );
        }
    }
}
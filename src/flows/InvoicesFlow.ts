import axios from 'axios';
import { SessionData } from '../interfaces/WhatsAppMessage';
import { User } from '../interfaces/User';
import { MessageService } from '../services/MessageService';
import { CustomerService } from '../services/CustomerService';
import { SecurityService } from '../services/SecurityService';
import { BaseConversationFlow } from './ConversationFlow';
import { Invoice } from '../interfaces/Invoice';

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
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const normalizedMessage = message.toLowerCase().trim();
        
        // Verificar si el usuario está autenticado
        if (!user.authenticated) {
            return false;
        }

        // Verificar si el usuario está consultando facturas
        return (
            session.consultingInvoices === true ||
            normalizedMessage === 'factura' ||
            normalizedMessage === 'facturas' ||
            normalizedMessage === 'mi factura' ||
            normalizedMessage === 'mis facturas' ||
            normalizedMessage === 'consultar factura' ||
            normalizedMessage === 'consultar facturas'
        );
    }

    /**
     * Maneja el mensaje del usuario
     */
    async handle(user: User, message: string, session: InvoicesSession): Promise<boolean> {
        try {
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

            // Consultar facturas (con caché)
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

            // Ordenar facturas por fecha de vencimiento (más reciente primero)
            const sortedInvoices = this.sortInvoicesByDueDate(invoices);

            // Mostrar resumen de facturas
            await this.showInvoicesSummary(user.phoneNumber, sortedInvoices);

            // Limpiar estado de consulta
            session.consultingInvoices = false;
            session.flowActive = '';
            return true;
        } catch (error) {
            console.error('Error al consultar facturas:', error);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Ocurrió un error al consultar tus facturas. Por favor, intenta más tarde.'
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
        // Intentar obtener de userServices
        if (user.userServices && user.userServices.length > 0) {
            return user.userServices[0].id || user.customerId || null;
        }

        // Intentar obtener de customerId
        return user.customerId || null;
    }

    /**
     * Obtiene las facturas con caché para evitar consultas repetidas
     */
    private async getInvoicesWithCache(
        serviceId: string | null,
        session: InvoicesSession,
        user: User
    ): Promise<any[]> {
        if (!serviceId) return [];
        
        console.log(`🔍 Consultando facturas para servicio ${serviceId} con caché optimizado`);

        // Inicializar caché si no existe
        if (!session.invoicesCache) {
            session.invoicesCache = {};
        }

        const now = Date.now();
        const cachedData = session.invoicesCache[serviceId];

        // Si hay datos en caché y no han expirado, usarlos
        if (cachedData && now - cachedData.timestamp < this.cacheDuration) {
            console.log(`📋 Usando facturas en caché para servicio ${serviceId}`);
            return cachedData.invoices;
        }

        // Si no hay caché o expiró, obtener nuevos datos
        console.log(`📥 Realizando actualización completa de facturas para servicio ${serviceId}`);
        const invoices = await this.fetchAllInvoicesFromAPI(serviceId, user);

        // Guardar en caché
        session.invoicesCache[serviceId] = {
            invoices,
            timestamp: now,
        };

        return invoices;
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
                
                console.log(`📄 Página ${page-1}: ${filteredInvoices.length} facturas del cliente ${serviceId} de ${results.length} totales`);
                
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
            }
            
            // Coincidir por nombre si está disponible (coincidencia parcial)
            if (userData?.customerName && clientData.nombre && 
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
        return [...invoices].sort((a, b) => {
            const dateA = new Date(a.fecha_vencimiento || a.dueDate);
            const dateB = new Date(b.fecha_vencimiento || b.dueDate);
            return dateB.getTime() - dateA.getTime(); // Más reciente primero
        });
    }

    /**
     * Muestra un resumen de las facturas al usuario
     */
    private async showInvoicesSummary(phoneNumber: string, invoices: any[]): Promise<void> {
        // Depurar estructura de facturas
        console.log(`🔍 [DEBUG] Estructura de facturas recibidas:`);
        invoices.slice(0, 2).forEach((invoice, i) => {
            console.log(`🧾 [DEBUG] Factura ${i + 1}:`, JSON.stringify(invoice, null, 2));
        });

        // Formatear moneda
        const formatCurrency = (amount: number | string | any): string => {
            console.log(`💲 [DEBUG] Valor de monto recibido:`, amount, typeof amount);
            
            // Manejar diferentes tipos de datos
            let numericAmount = 0;
            
            if (typeof amount === 'string') {
                // Limpiar string de caracteres no numéricos excepto punto decimal
                const cleanedAmount = amount.replace(/[^0-9.]/g, '');
                numericAmount = parseFloat(cleanedAmount) || 0;
            } else if (typeof amount === 'number') {
                numericAmount = amount;
            } else if (amount && typeof amount === 'object') {
                // Si es un objeto, intentar extraer un valor numérico
                if ('valor' in amount) numericAmount = parseFloat(amount.valor) || 0;
                else if ('value' in amount) numericAmount = parseFloat(amount.value) || 0;
                else if ('monto' in amount) numericAmount = parseFloat(amount.monto) || 0;
                else if ('amount' in amount) numericAmount = parseFloat(amount.amount) || 0;
            }
            
            console.log(`💲 [DEBUG] Monto procesado:`, numericAmount);
            
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0
            }).format(numericAmount);
        };

        // Formatear fecha
        const formatDate = (dateStr: string | Date | any): string => {
            console.log(`📅 [DEBUG] Valor de fecha recibido:`, dateStr, typeof dateStr);
            
            try {
                // Si es un objeto Date, usarlo directamente
                let date: Date;
                
                if (dateStr instanceof Date) {
                    date = dateStr;
                } else if (typeof dateStr === 'string') {
                    date = new Date(dateStr);
                } else if (dateStr && typeof dateStr === 'object') {
                    // Si es un objeto, intentar extraer un valor de fecha
                    if ('fecha_vencimiento' in dateStr) date = new Date(dateStr.fecha_vencimiento);
                    else if ('dueDate' in dateStr) date = new Date(dateStr.dueDate);
                    else if ('vencimiento' in dateStr) date = new Date(dateStr.vencimiento);
                    else date = new Date();
                } else {
                    // Valor por defecto
                    date = new Date();
                }
                
                // Verificar si la fecha es válida
                if (isNaN(date.getTime())) {
                    console.log(`⚠️ [DEBUG] Fecha inválida:`, dateStr);
                    return 'Fecha no disponible';
                }
                
                // Extraer componentes de la fecha manualmente para evitar problemas de zona horaria
                const day = date.getUTCDate();
                const month = date.getUTCMonth();
                const year = date.getUTCFullYear();
                
                // Array de nombres de meses en español
                const monthNames = [
                    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
                ];
                
                // Formatear manualmente
                const formattedDate = `${day} de ${monthNames[month]} de ${year}`;
                
                console.log(`📅 [DEBUG] Fecha formateada:`, formattedDate);
                return formattedDate;
            } catch (error) {
                console.error('❌ Error al formatear fecha:', error);
                return 'Fecha no disponible';
            }
        };

        // Construir mensaje
        let message = '📄 *TUS FACTURAS*\n\n';

        // Mostrar facturas recientes
        const recentInvoices = invoices.slice(0, 5); // Mostrar máximo 5 facturas
        
        if (recentInvoices.length > 0) {
            recentInvoices.forEach((invoice, index) => {
                console.log(`🧾 [DEBUG] Procesando factura ${index + 1}:`, invoice?.id || 'sin ID');
                
                // Extraer y depurar valores - usar directamente los valores normalizados
                // Estos valores fueron normalizados en fetchAllInvoicesFromAPI
                const amount = invoice.amount || invoice.monto || 50000; // Valor por defecto si no hay monto
                
                console.log(`💲 [DEBUG] Monto normalizado:`, amount, typeof amount);
                
                // Usar directamente la fecha normalizada
                const dueDate = invoice.dueDate || new Date(invoice.fecha_vencimiento) || new Date();
                
                console.log(`📅 [DEBUG] Fecha normalizada:`, dueDate instanceof Date ? dueDate.toISOString() : dueDate, typeof dueDate);
                
                // Buscar el estado en diferentes propiedades posibles
                const status = invoice.estado || invoice.status || 'pendiente';
                const isPaid = status.toLowerCase().includes('pagad') || status.toLowerCase().includes('paid');
                const statusEmoji = isPaid ? '✅' : '⏳';
                
                message += `${statusEmoji} *Factura #${invoice.id || index + 1}*\n`;
                message += `💰 Monto: ${formatCurrency(amount)}\n`;
                message += `📅 Vence: ${formatDate(dueDate)}\n`;
                message += `🔄 Estado: ${isPaid ? 'Pagada' : 'Pendiente'}\n\n`;
            });

            // Enviar mensaje con las facturas
            await this.messageService.sendTextMessage(phoneNumber, message);
            
            // Enviar opciones interactivas para pago y navegación
            const optionsMessage = {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: {
                        type: 'text',
                        text: '💳 Opciones de Pago'
                    },
                    body: {
                        text: '¿Qué deseas hacer ahora?'
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: {
                                    id: 'puntos_pago',
                                    title: '📍 Puntos de Pago'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'menu',
                                    title: '🏠 Menú Principal'
                                }
                            }
                        ]
                    }
                }
            };
            
            await this.messageService.sendMessage(optionsMessage);
        } else {
            message += '❌ No se encontraron facturas recientes.\n';
            await this.messageService.sendTextMessage(phoneNumber, message);
            
            // Enviar opción para volver al menú principal
            const optionsMessage = {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: {
                        text: '¿Qué deseas hacer ahora?'
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: {
                                    id: 'menu',
                                    title: '🏠 Menú Principal'
                                }
                            }
                        ]
                    }
                }
            };
            
            await this.messageService.sendMessage(optionsMessage);
        }
    }

    /**
     * Extrae datos del usuario para filtrado
     */
    private extractUserData(user: User): any {
        const result: any = {
            serviceId: null,
            customerName: null,
            cedula: null,
            hasServices: false
        };

        // Extraer de userServices si está disponible
        if (user.userServices && user.userServices.length > 0) {
            result.serviceId = user.userServices[0].id;
            result.customerName = user.userServices[0].name;
            result.hasServices = true;
        }

        // Si no hay datos en userServices, intentar extraer de encryptedData
        if (!result.customerName && user.encryptedData) {
            try {
                // Intentar decodificar datos encriptados
                const decodedData = this.decodeUserData(user);
                if (decodedData) {
                    result.customerName = decodedData.name || decodedData.nombre;
                    result.cedula = decodedData.document || decodedData.cedula || decodedData.documento;
                }
            } catch (error) {
                console.error('Error al decodificar datos de usuario:', error);
            }
        }

        // Si aún no hay datos, usar customerId como último recurso
        if (!result.serviceId && user.customerId) {
            result.serviceId = user.customerId;
        }

        return result;
    }
}
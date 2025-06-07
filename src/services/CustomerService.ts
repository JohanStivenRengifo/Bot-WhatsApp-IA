import axios from 'axios';
import ping from 'ping';
import { config } from '../config';
import { Invoice, CustomerData, PlanData, DebtInfo, OverdueCustomer, PaymentPoint } from '../interfaces';

// Interface for WispHub API customer response
interface WispHubCustomer {
    id_servicio: string;
    nombre?: string;
    documento?: string;
    cedula?: string;
    email?: string;
    ip?: string;
    estado?: string;
}

export class CustomerService {    /**
     * Autentica un cliente por cédula o ID de servicio
     * @param input - Cédula o ID de servicio (1-12 dígitos)
     * @returns CustomerData si se encuentra y está activo, null si no
     */
    async authenticateCustomer(input: string): Promise<CustomerData | null> {
        try {
            // Normalizar la entrada (eliminar espacios y caracteres especiales)
            const normalizedInput = input.replace(/[^0-9]/g, '').trim();

            // Validar formato básico (1-12 dígitos para cédula o ID de servicio)
            if (!/^\d{1,12}$/.test(normalizedInput)) {
                console.log('Formato de entrada inválido');
                return null;
            }

            console.log(`🔍 Consultando cliente por: ${normalizedInput} (puede ser cédula o ID de servicio)`);

            // Primero intentar buscar por ID de servicio directamente
            const serviceResult = await this.searchByServiceId(normalizedInput);
            if (serviceResult) {
                console.log(`✅ Cliente encontrado por ID de servicio: ${serviceResult.name}`);
                return serviceResult;
            }

            // Si no se encuentra por ID de servicio, buscar por cédula
            const documentResult = await this.searchByDocument(normalizedInput);
            if (documentResult) {
                console.log(`✅ Cliente encontrado por cédula: ${documentResult.name}`);
                return documentResult;
            }

            console.log(`❌ No se encontró cliente con cédula o ID de servicio: ${normalizedInput}`);
            return null;
        } catch (error) {
            console.error('Error en autenticación de cliente:', error);
            return null;
        }
    }

    /**
     * Busca un cliente por ID de servicio directamente
     */
    private async searchByServiceId(serviceId: string): Promise<CustomerData | null> {
        try {
            console.log(`🔍 Buscando por ID de servicio: ${serviceId}`);

            // Intentar acceder directamente al servicio por ID
            const serviceResponse = await axios.get(`${config.wisphub.baseUrl}clientes/${serviceId}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            if (serviceResponse.data && serviceResponse.data.id_servicio) {
                const cliente = serviceResponse.data;

                // Verificar estado del servicio
                const estadoServicio = cliente.estado?.toLowerCase();
                const isActive = estadoServicio === 'activo' || estadoServicio === 'active'; console.log(`📋 Servicio encontrado: ${cliente.nombre || 'Sin nombre'} - Estado: ${cliente.estado}`);

                // Mapear la respuesta al formato CustomerData
                const customerData: CustomerData = {
                    id: cliente.id_servicio,
                    name: cliente.nombre?.trim() || cliente.id_servicio || 'Cliente',
                    email: cliente.email || '',
                    document: cliente.documento || cliente.cedula || '',
                    ip_address: cliente.ip || '',
                    status: cliente.estado || 'unknown',
                    isInactive: !isActive
                };

                console.log(`✅ Cliente procesado: ${customerData.name} (ID: ${customerData.id})`);
                return customerData;
            }

            return null;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    console.log(`🔍 No se encontró servicio con ID: ${serviceId}`);
                } else {
                    console.error(`Error buscando por ID de servicio (${error.response?.status}):`, error.response?.data);
                }
            } else {
                console.error('Error en búsqueda por ID de servicio:', error);
            }
            return null;
        }
    }

    /**
     * Busca un cliente por número de cédula/documento
     */
    private async searchByDocument(documentNumber: string): Promise<CustomerData | null> {
        try {
            console.log(`🔍 Buscando por cédula/documento: ${documentNumber}`);

            // Paso 1: Buscar el cliente por número de documento en la API de WispHub
            console.log(`🔎 URL API: ${config.wisphub.baseUrl}clientes`);
            console.log(`🔑 API Key: ${config.wisphub.apiKey}`);

            // Primero intentamos buscar por el documento exacto
            let searchResponse = await axios.get(`${config.wisphub.baseUrl}clientes`, {
                headers: { 'Authorization': config.wisphub.apiKey },
                params: { documento: documentNumber, limit: 20 }
            });

            // Si no encontramos resultados exactos, buscamos en todos los clientes
            if (!searchResponse.data?.results?.length) {
                console.log(`📊 No se encontraron coincidencias exactas por documento, realizando búsqueda amplia...`);
                searchResponse = await axios.get(`${config.wisphub.baseUrl}clientes`, {
                    headers: { 'Authorization': config.wisphub.apiKey },
                    params: { limit: 1000, search: documentNumber }
                });
            }

            // Variable para almacenar los clientes encontrados
            let clientesEncontrados: WispHubCustomer[] = [];

            // Verificar si hay datos en la respuesta y manejar diferentes formatos
            if (searchResponse.data) {
                if (searchResponse.data.results && Array.isArray(searchResponse.data.results)) {
                    // Formato paginado (results es un array)
                    clientesEncontrados = searchResponse.data.results;
                    console.log(`📊 Respuesta paginada - Total: ${searchResponse.data.count}, En esta página: ${clientesEncontrados.length}`);

                    // Mostrar los primeros 5 documentos para depuración
                    const documentosEncontrados = clientesEncontrados
                        .map(c => ({ documento: c.documento || c.cedula || 'Sin documento', nombre: c.nombre || 'Sin nombre' }))
                        .slice(0, 5);
                    console.log(`📋 Primeros documentos encontrados:`, JSON.stringify(documentosEncontrados, null, 2));
                } else if (Array.isArray(searchResponse.data)) {
                    // Formato de array directo
                    clientesEncontrados = searchResponse.data;
                    console.log(`📊 Array directo - Total de clientes: ${clientesEncontrados.length}`);
                } else {
                    console.log(`⚠️ Formato no reconocido - Tipo: ${typeof searchResponse.data}`);
                    return null;
                }
            } else {
                console.log('❌ No se recibieron datos de la API');
                return null;
            }

            // Si no hay clientes, terminar
            if (clientesEncontrados.length === 0) {
                console.log('No se encontró cliente con ese número de documento');
                return null;
            }

            // Buscar coincidencia exacta de cédula
            const cliente = clientesEncontrados.find(c => {
                const clienteDoc = (c.documento || c.cedula || '').toString().replace(/[^0-9]/g, '').trim();
                const coincidenciaExacta = clienteDoc === documentNumber;

                if (coincidenciaExacta) {
                    console.log(`✅ Coincidencia exacta encontrada para documento ${documentNumber} - Cliente: ${c.nombre}`);
                }

                return coincidenciaExacta;
            });

            // Si no se encuentra coincidencia exacta, mostrar posibles coincidencias para debug
            if (!cliente) {
                const similarDocs = clientesEncontrados
                    .map(c => {
                        const doc = (c.documento || c.cedula || '').toString().replace(/[^0-9]/g, '').trim();
                        return {
                            documento: doc,
                            nombre: c.nombre || 'Sin nombre',
                            similitud: doc.includes(documentNumber.slice(-4)) ? 'Alta' : 'Baja'
                        };
                    })
                    .filter(c => c.similitud === 'Alta')
                    .slice(0, 5);

                if (similarDocs.length > 0) {
                    console.log(`🔍 No se encontró coincidencia exacta. Documentos similares:`, JSON.stringify(similarDocs, null, 2));
                } else {
                    console.log(`🔍 No se encontró coincidencia exacta ni documentos similares.`);
                }
                return null;
            }

            // Verificar que el cliente tenga ID válido
            if (!cliente || !cliente.id_servicio) {
                console.log('Cliente encontrado pero sin ID válido');
                return null;
            }

            // Paso 2: Consultar los detalles del servicio para verificar si está activo
            const serviceResponse = await axios.get(`${config.wisphub.baseUrl}clientes/${cliente.id_servicio}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            // Verificar si el servicio está activo
            const estadoServicio = serviceResponse.data?.estado?.toLowerCase();
            if (!serviceResponse.data || (estadoServicio !== 'activo' && estadoServicio !== 'active')) {
                console.log(`Cliente encontrado pero servicio no activo (Estado: ${serviceResponse.data?.estado || 'desconocido'})`);

                // Devolver el cliente con un flag de inactivo para mostrar mensaje personalizado
                return {
                    id: cliente.id_servicio,
                    name: cliente.nombre || 'Cliente',
                    email: cliente.email || '',
                    document: documentNumber,
                    ip_address: cliente.ip || '',
                    status: serviceResponse.data?.estado || 'inactive',
                    isInactive: true
                };
            }

            // Mapear la respuesta al formato CustomerData
            const customerData: CustomerData = {
                id: cliente.id_servicio,
                name: cliente.nombre || 'Cliente',
                email: cliente.email || '',
                document: documentNumber,
                ip_address: cliente.ip || '',
                status: serviceResponse.data?.estado || 'unknown'
            };

            console.log(`✅ Cliente autenticado: ${customerData.name} (ID: ${customerData.id})`);
            return customerData;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                console.error(`Error de API (${error.response.status}):`, error.response.data);
            } else {
                console.error('Customer authentication error:', error);
            }
            return null;
        }
    }

    async getCustomerInfo(customerId: string): Promise<CustomerData> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}clientes/${customerId}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return {
                id: response.data.id,
                name: response.data.nombre || 'Cliente',
                email: response.data.email,
                document: response.data.documento || response.data.cedula,
                ip_address: response.data.ip || '',
                status: response.data.estado
            };
        } catch (error) {
            console.error('Get customer info error:', error);
            throw error;
        }
    }

    async pingIP(ipAddress: string): Promise<ping.PingResponse> {
        try {
            const result = await ping.promise.probe(ipAddress, {
                timeout: 10,
                extra: ['-c', '3']
            });

            return result;
        } catch (error) {
            console.error('Ping error:', error);
            return {
                host: ipAddress,
                alive: false,
            } as ping.PingResponse;
        }
    }

    async getCustomerInvoices(customerId: string): Promise<Invoice[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}clientes/${customerId}/facturas`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get customer invoices error:', error);
            return [];
        }
    }

    async getCustomerDebt(customerId: string): Promise<DebtInfo | null> {
        try {
            const invoicesResponse = await axios.get(`${config.wisphub.baseUrl}clientes/${customerId}/facturas`, {
                headers: { 'Authorization': config.wisphub.apiKey },
                params: { estado: 'pendiente' }
            });

            const pendingInvoices = invoicesResponse.data.results || [];
            const totalDebt = pendingInvoices.reduce((sum: number, invoice: Invoice) => {
                return sum + (invoice.monto ?? invoice.amount ?? 0);
            }, 0);

            // Obtener la próxima fecha de vencimiento
            let nextDueDate = new Date();
            if (pendingInvoices.length > 0) {
                // Ordenar facturas por fecha de vencimiento
                pendingInvoices.sort((a: Invoice, b: Invoice) => {
                    const dateA = a.fecha_vencimiento ? new Date(a.fecha_vencimiento) : (a.dueDate || new Date());
                    const dateB = b.fecha_vencimiento ? new Date(b.fecha_vencimiento) : (b.dueDate || new Date());
                    return dateA.getTime() - dateB.getTime();
                });

                const firstInvoice = pendingInvoices[0];
                nextDueDate = firstInvoice.fecha_vencimiento ?
                    new Date(firstInvoice.fecha_vencimiento) :
                    (firstInvoice.dueDate || new Date());
            }

            return {
                totalDebt,
                totalAmount: totalDebt, // Alias para compatibilidad
                pendingInvoices: pendingInvoices.length,
                invoicesCount: pendingInvoices.length, // Alias para compatibilidad
                nextDueDate,
                overdueAmount: this.calculateOverdueAmount(pendingInvoices),
                status: this.determineDebtStatus(totalDebt, pendingInvoices)
            };
        } catch (error) {
            console.error('Get customer debt error:', error);
            return null;
        }
    }

    private calculateOverdueAmount(invoices: Invoice[]): number {
        const today = new Date();
        return invoices
            .filter(invoice => {
                const dueDate = invoice.fecha_vencimiento ?
                    new Date(invoice.fecha_vencimiento) :
                    (invoice.dueDate || new Date());
                return dueDate < today;
            })
            .reduce((sum, invoice) => sum + (invoice.monto ?? invoice.amount ?? 0), 0);
    }

    async getCustomerPlan(customerId: string): Promise<PlanData | null> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}clientes/${customerId}`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            if (!response.data || !response.data.plan) {
                return null;
            }

            return {
                id: response.data.plan.id,
                name: response.data.plan.nombre,
                speed: `${response.data.plan.velocidad_descarga}/${response.data.plan.velocidad_subida} Mbps`,
                price: response.data.plan.precio,
                description: response.data.plan.descripcion
            };
        } catch (error) {
            console.error('Get customer plan error:', error);
            return null;
        }
    }

    async getPaymentPoints(): Promise<PaymentPoint[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}puntos-pago`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get payment points error:', error);
            return [];
        }
    }

    async getOverdueCustomers(): Promise<OverdueCustomer[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}clientes/morosos`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get overdue customers error:', error);
            return [];
        }
    }

    async needsHumanAssistance(message: string): Promise<boolean> {
        const keywords = [
            'asesor',
            'agente',
            'humano',
            'persona'
        ];
        const messageNormalized = message.toLowerCase().trim();
        return keywords.some(keyword => messageNormalized.includes(keyword));
    }

    async verifyPassword(customerId: string, password: string): Promise<boolean> {
        try {
            const response = await axios.post(`${config.wisphub.baseUrl}clientes/${customerId}/verificar-password`,
                { password },
                { headers: { 'Authorization': config.wisphub.apiKey } }
            );

            return response.data.valid === true;
        } catch (error) {
            console.error('Verify password error:', error);
            return false;
        }
    }

    async updatePassword(customerId: string, newPassword: string): Promise<boolean> {
        try {
            const response = await axios.post(`${config.wisphub.baseUrl}clientes/${customerId}/actualizar-password`,
                { newPassword },
                { headers: { 'Authorization': config.wisphub.apiKey } }
            );

            return response.data.success === true;
        } catch (error) {
            console.error('Update password error:', error);
            return false;
        }
    } async getServiceOutages(): Promise<any[]> {
        try {
            // Corrigiendo la URL: es posible que el endpoint haya cambiado a esta ruta más común
            const response = await axios.get(`${config.wisphub.baseUrl}servicios/mantenimientos`, {
                headers: { 'Authorization': config.wisphub.apiKey }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get service outages error:', error);

            // Importamos la utilidad de registro de errores
            const { logIntegrationError } = require('../utils/debugUtils');

            // Registramos el error con detalles para diagnóstico
            logIntegrationError(
                'WispHub',
                `${config.wisphub.baseUrl}servicios/mantenimientos`,
                error
            );

            // En caso de error, devolver un array vacío en lugar de fallar por completo
            return [];
        }
    }

    async getAffectedUsers(area: string): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}clientes`, {
                headers: { 'Authorization': config.wisphub.apiKey },
                params: { area }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Get affected users error:', error);
            return [];
        }
    }

    /**
     * Obtiene información detallada del servicio del cliente
     */
    async getCustomerServiceInfo(customerId: string): Promise<any> {
        try {
            // En un entorno real, esta información se obtendría de la API
            // Aquí simulamos la obtención de datos del servicio

            // Obtener información básica del cliente primero
            const customerInfo = await this.getCustomerInfo(customerId);
            if (!customerInfo) {
                throw new Error('Cliente no encontrado');
            }

            // Generar una IP basada en el ID (simulado)
            const ipBlocks = customerId.split('').map(c => parseInt(c) || 1);
            const ipAddress = `172.${ipBlocks[0] || 2}.${ipBlocks[1] || 9}.${parseInt(customerId.substring(0, 3)) % 255 || 77}`;

            // Generar fecha de instalación (simulada)
            const currentDate = new Date();
            const installationDate = new Date(
                currentDate.getFullYear() - 1,
                Math.floor(Math.random() * 11), // Mes aleatorio
                Math.floor(Math.random() * 28) + 1, // Día aleatorio
                Math.floor(Math.random() * 12) + 8, // Hora aleatoria entre 8 y 20
                Math.floor(Math.random() * 59) // Minuto aleatorio
            );

            // Obtener información del plan
            let plan = '50MB';
            try {
                const planInfo = await this.getCustomerPlan(customerId);
                if (planInfo) {
                    plan = `${planInfo.speed},T-Simple Queue`;
                }
            } catch (error) {
                console.error('Error obteniendo información del plan:', error);
            }

            // Construir nombre de usuario basado en documento y nombre
            const username = `${customerInfo.document?.substring(0, 4) || '0000'} ${customerInfo.name.toUpperCase()}`;

            // Seleccionar zona y router aleatoriamente (simulado)
            const zones = ['SERVIDOR CORRALES E', 'SERVIDOR PRINCIPAL', 'ZONA NORTE', 'ZONA SUR'];
            const routers = ['SERVIDOR CORRALES E', 'ROUTER PRINCIPAL', 'MIKROTIK RB3011', 'CISCO GW-200'];

            const zone = zones[parseInt(customerId.substring(0, 1)) % zones.length];
            const router = routers[parseInt(customerId.substring(0, 1)) % routers.length];

            return {
                username: username,
                ipAddress: ipAddress,
                plan: plan,
                router: router,
                zone: zone,
                accessPoint: zone, // Usar la misma zona como punto de acceso por simplicidad
                installationDate: installationDate
            };
        } catch (error) {
            console.error('Error al obtener información de servicio del cliente:', error);
            return null;
        }
    }

    /**
     * Determina el estado de la deuda basado en el monto y facturas
     */
    private determineDebtStatus(totalDebt: number, pendingInvoices: any[]): 'pending' | 'overdue' | 'critical' | 'partial' {
        if (totalDebt === 0) return 'pending';

        const today = new Date();
        const overdueInvoices = pendingInvoices.filter(invoice => {
            const dueDate = invoice.fecha_vencimiento ?
                new Date(invoice.fecha_vencimiento) :
                (invoice.dueDate || new Date());
            return dueDate < today;
        });

        if (overdueInvoices.length === 0) return 'pending';
        if (totalDebt > 100000) return 'critical'; // Monto crítico
        if (overdueInvoices.length > 2) return 'critical';

        return 'overdue';
    }
}
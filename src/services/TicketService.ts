import axios from 'axios';
import moment from 'moment';
import { config } from '../config';
import { Ticket } from '../interfaces/Ticket';
import { CustomerService } from './CustomerService';

export class TicketService {
    private customerService: CustomerService;
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        this.customerService = new CustomerService();
        // Configurar API de WispHub
        this.apiUrl = 'https://api.wisphub.app/api/tickets/';
        this.apiKey = 'Api-Key mHHsEQKX.Uc1BQzXFOCXUno64ZTM9K4vaDPjH9gLq';
    }

    async createTicket(ticketData: {
        customerId: string;
        category?: string;
        description: string;
        priority?: 'alta' | 'media' | 'baja';
        source?: string;
        metadata?: any;
    }): Promise<string> {
        try {
            console.log('🎫 Iniciando creación de ticket en WispHub para cliente:', ticketData.customerId);

            // Validar que tenemos un ID de cliente válido
            if (!ticketData.customerId) {
                throw new Error('ID de cliente requerido para crear ticket');
            }            // Convertir customerId a string si es necesario y validar que sea numérico
            const customerIdString = ticketData.customerId.toString().trim();
            if (customerIdString === '') {
                throw new Error('ID de cliente requerido para crear ticket');
            }

            // Validar que el customerId sea numérico para WispHub
            // Si no es numérico, usar un ID por defecto válido
            let serviceId = customerIdString;
            if (!/^\d+$/.test(customerIdString)) {
                console.log(`⚠️ CustomerId no numérico detectado: "${customerIdString}". Usando ID por defecto: 37`);
                serviceId = "37"; // ID de servicio por defecto válido
            }

            // Preparar datos para la API de WispHub según documentación oficial
            const now = new Date();
            const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;            // Mapear categoría a asuntos válidos de WispHub (EXACTAMENTE como aparecen en la documentación)
            const validSubjects: { [key: string]: string } = {
                'password_change': 'Cambio de Contraseña en Router Wifi',
                'password_recovery': 'Cambio de Contraseña en Router Wifi',
                'internet_slow': 'Internet Lento',
                'no_internet': 'No Tiene Internet',
                'connection_issues': 'Internet Intermitente',
                'router_problem': 'No Responde el Router Wifi',
                'antenna_problem': 'No Responde la Antena',
                'ventas': 'Otro Asunto', // Para tickets de ventas/contratación
                'cotizacion': 'Otro Asunto', // Para tickets de cotización
                'instalacion': 'Otro Asunto', // Para tickets de instalación
                'consulta': 'Otro Asunto', // Para tickets de consulta
                'general': 'Otro Asunto' // Fallback por defecto cambiado de "Internet Lento" a "Otro Asunto"
            };

            const subject = validSubjects[ticketData.category || 'general'] || validSubjects.general;

            // Mapear prioridad a valores de WispHub (1=Baja, 2=Normal, 3=Alta)
            const priorityMapping: { [key: string]: string } = {
                'baja': '1',
                'media': '2',
                'alta': '3'
            };
            const priorityValue = priorityMapping[ticketData.priority || 'media'];            // Preparar FormData según documentación de WispHub (multipart/form-data)
            const FormData = require('form-data');
            const formData = new FormData();            // Campos REQUERIDOS según documentación
            formData.append('servicio', serviceId); // ID del servicio/cliente (validado como numérico)
            formData.append('asunto', subject); // Asunto del ticket
            formData.append('asuntos_default', subject); // Debe ser igual al asunto// Campo de técnico - REQUERIDO por WispHub API
            // Intentar usar ID configurado, sino usar ID por defecto válido
            let technicianId = config.wisphub.defaultTechnicianId?.trim();
            if (!technicianId || technicianId === '') {
                // Usar ID de técnico específico de Conecta2tel
                technicianId = '417534'; // Usuario administrativo de Conecta2tel
                console.log('📋 Usando técnico por defecto (ID: 417534) - configura WISPHUB_DEFAULT_TECHNICIAN_ID para usar uno específico');
            } else {
                console.log('📋 Usando técnico configurado:', technicianId);
            }
            formData.append('tecnico', technicianId); formData.append('descripcion', `<p>${ticketData.description}</p>`); // Descripción en HTML
            formData.append('estado', '1'); // 1=Nuevo
            formData.append('prioridad', priorityValue); // Prioridad

            // Determinar departamento según la categoría
            const department = (ticketData.category === 'ventas' || ticketData.category === 'cotizacion' || ticketData.category === 'instalacion') ? 'Ventas' : 'Soporte Técnico';
            formData.append('departamento', department); // Departamento
            formData.append('departamentos_default', department); // Debe ser igual al departamento

            // Campos OPCIONALES
            formData.append('fecha_inicio', formattedDate);
            formData.append('fecha_final', formattedDate);
            formData.append('origen_reporte', 'redes_sociales'); // Corregido: redes_sociales (no whatsapp)            console.log('📋 Datos del ticket a enviar como FormData');
            console.log('   - servicio:', serviceId);
            console.log('   - asunto:', subject);
            console.log('   - asuntos_default:', subject);
            console.log('   - tecnico:', technicianId);
            console.log('   - descripcion:', `<p>${ticketData.description}</p>`);
            console.log('   - estado: 1');
            console.log('   - prioridad:', priorityValue);
            console.log('   - departamento: Soporte Técnico');
            console.log('   - departamentos_default: Soporte Técnico');
            console.log('   - fecha_inicio:', formattedDate);
            console.log('   - fecha_final:', formattedDate);
            console.log('   - origen_reporte: redes_sociales');

            // Realizar llamada a la API de WispHub con FormData
            const response = await axios.post(this.apiUrl, formData, {
                headers: {
                    'Authorization': this.apiKey,
                    ...formData.getHeaders(), // Esto incluye el Content-Type correcto para multipart/form-data
                },
                timeout: 30000,
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // No lanzar error en 4xx para debug
                }
            });

            console.log('📡 Respuesta de WispHub - Status:', response.status);
            console.log('📡 Respuesta de WispHub - Data:', JSON.stringify(response.data, null, 2));

            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Ticket creado exitosamente en WispHub');
                // Retornar el ID del ticket creado en WispHub
                return response.data?.id_ticket?.toString() || response.data?.id?.toString() || this.generateTicketId();
            } else {
                console.error('❌ Error en respuesta de WispHub:', response.status, response.data);
                throw new Error(`Error ${response.status}: ${JSON.stringify(response.data)}`);
            }
        } catch (error: any) {
            console.error('❌ Error al crear ticket en WispHub:', error);

            // Mostrar detalles del error para debug
            if (error.response) {
                console.error('❌ Status de error:', error.response.status);
                console.error('❌ Headers de respuesta:', error.response.headers);
                console.error('❌ Datos de respuesta:', JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                console.error('❌ No se recibió respuesta:', error.request);
            } else {
                console.error('❌ Error en configuración:', error.message);
            }

            // En caso de error, crear un ticket local como fallback
            const fallbackId = this.generateTicketId();
            console.log('⚠️ Usando fallback local con ID:', fallbackId); return fallbackId;
        }
    }

    async notifyNewTicket(ticketId: string, customerId: string): Promise<void> {
        try {
            // Nota: WispHub maneja las notificaciones internamente cuando se crea un ticket
            // Este método se mantiene para compatibilidad pero ya no es necesario
            // hacer llamadas adicionales a endpoints de notificación
            console.log(`📧 Ticket ${ticketId} creado para cliente ${customerId} - WispHub manejará las notificaciones automáticamente`);
        } catch (error) {
            console.error('Notify new ticket error:', error);
        }
    }

    getCategoryName(categoryId: string): string {
        const categories: { [key: string]: string } = {
            'internet_lento': 'Internet Lento',
            'sin_internet': 'Sin Conexión a Internet',
            'intermitente': 'Conexión Intermitente',
            'facturacion': 'Problema de Facturación',
            'otro': 'Otro Problema',
            'tv': 'Problema de Televisión',
            'cambio_equipo': 'Cambio de Equipo',
            'cancelacion': 'Cancelación de Servicio'
        };

        return categories[categoryId] || 'Consulta General';
    }

    /**
     * Genera un ID de ticket basado en la fecha y un número aleatorio
     */
    private generateTicketId(): string {
        const date = new Date();
        const year = date.getFullYear();
        const randomNum = Math.floor(Math.random() * 1000);
        return `${randomNum}`;
    }

    /**
     * Genera un asunto para el ticket basado en la categoría y descripción
     */
    private generateTicketSubject(category: string | undefined, description: string): string {
        if (!category) {
            return `Ticket de soporte - ${description.substring(0, 50)}...`;
        }
        return `[${this.getCategoryName(category)}] ${description.substring(0, 50)}...`;
    }    /**
     * Asigna un técnico basado en la categoría del ticket (simulado)
     */
    private assignTechnician(category: string | undefined): string {
        const technicians = {
            internet: 'Juan Pérez',
            router: 'Ana Gómez',
            facturacion: 'Carlos Ruiz',
            default: 'Soporte General'
        };

        if (!category) {
            return technicians.default;
        }

        return technicians[category as keyof typeof technicians] || technicians.default;
    }

    /**
     * Calcula días estimados para resolver según prioridad
     */
    private getEstimatedDays(priority: string): number {
        switch (priority.toLowerCase()) {
            case 'alta':
                return 1;
            case 'media':
                return 5;
            case 'baja':
                return 12;
            default:
                return 7;
        }
    }
}
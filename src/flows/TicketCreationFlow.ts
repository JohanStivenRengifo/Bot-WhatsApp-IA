import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, TicketService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';
import axios from 'axios';
import { config } from '../config';

/**
 * Flujo especializado para creación de tickets con WispHub API
 */
export class TicketCreationFlow extends BaseConversationFlow {
    readonly name: string = 'ticketCreation';

    private ticketService: TicketService;
    private apiKey: string;
    private apiUrl: string; constructor(
        messageService: MessageService,
        securityService: SecurityService,
        ticketService: TicketService
    ) {
        super(messageService, securityService);
        this.ticketService = ticketService;

        // Configurar API key y URL directamente para garantizar conexión correcta
        this.apiKey = 'Api-Key mHHsEQKX.Uc1BQzXFOCXUno64ZTM9K4vaDPjH9gLq';
        this.apiUrl = 'https://api.wisphub.app/api/tickets/';
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Normalizar el mensaje para facilitar la comparación
        const extractedCommand = extractMenuCommand(message);

        // Este flujo maneja:
        // 1. Cuando se selecciona "Crear Ticket" del menú de soporte
        // 2. Cuando está en proceso de creación de ticket
        // 3. Cuando el usuario escribe variantes de "crear ticket" o "reportar problema"
        return (
            user.authenticated &&
            (extractedCommand === 'ticket' ||
                session.creatingTicket === true ||
                isMenuCommand(message, ['crear_ticket', 'ticket_creation', 'soporte',
                    'reportar_falla', 'crear ticket', 'reportar problema']))
        );
    }

    /**
     * Maneja el proceso completo de creación de tickets
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Verificar que el usuario tenga servicio activo
            const userData = this.decodeUserData(user);
            if (userData?.isInactive) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '⚠️ Tu servicio está actualmente inactivo.\n\n' +
                    'Para crear tickets de soporte técnico, primero debes regularizar tu cuenta.\n\n' +
                    'Te recomendamos:\n' +
                    '1️⃣ Verificar el estado de tu facturación\n' +
                    '2️⃣ Realizar el pago pendiente si lo hubiera\n' +
                    '3️⃣ Contactar a nuestro equipo de atención al cliente');
                return true;
            }            // Iniciar la creación de ticket o continuar si ya está en proceso
            if (!session.creatingTicket) {
                session.creatingTicket = true;
                return await this.initializeTicketCreation(user, session);
            } else if (!session.step) {
                // El flujo ya está activo pero no tiene step definido (recién activado por ClientMenuFlow)
                return await this.initializeTicketCreation(user, session);
            }

            // Procesar según el paso actual
            switch (session.step) {
                case 'category':
                    return await this.handleCategorySelection(user, message, session);
                case 'description':
                    return await this.handleDescriptionInput(user, message, session);
                default:
                    return await this.initializeTicketCreation(user, session);
            }

        } catch (error) {
            console.error('Error en flujo de creación de tickets:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ha ocurrido un error al crear el ticket. Por favor, intenta nuevamente.');

            // Limpiar estado de sesión
            this.resetTicketSession(session);
            return true;
        }
    }    /**
     * Inicializa el proceso de creación de tickets
     */
    private async initializeTicketCreation(user: User, session: SessionData): Promise<boolean> {
        // Obtener datos del cliente usando el método mejorado
        const userData = this.decodeUserData(user);
        let clientName = "cliente";

        if (userData && userData.customerName) {
            clientName = userData.customerName.split(' ')[0];
        }

        session.creatingTicket = true;
        session.step = 'category';
        session.ticketData = {
            startTime: new Date(),
            clientName: clientName
        };

        // Categorías predefinidas para tickets
        const categoryMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🎫 Reportar Falla'
                },
                body: {
                    text: `Hola ${clientName}, vamos a reportar tu falla técnica.\n\n🔧 Selecciona el problema que estás experimentando:`
                },
                footer: {
                    text: 'Tu reporte será atendido por nuestro equipo especializado'
                },
                action: {
                    button: 'Seleccionar Problema',
                    sections: [
                        {
                            title: 'Problemas de Internet',
                            rows: [
                                {
                                    id: 'sin_internet',
                                    title: '🚫 Sin Internet',
                                    description: 'No hay conexión a internet'
                                },
                                {
                                    id: 'internet_lento',
                                    title: '🐌 Internet Lento',
                                    description: 'Velocidad menor a la contratada'
                                },
                                {
                                    id: 'intermitente',
                                    title: '📶 Conexión Intermitente',
                                    description: 'Se corta constantemente'
                                }
                            ]
                        },
                        {
                            title: 'Problemas de Equipos',
                            rows: [
                                {
                                    id: 'router_problema',
                                    title: '📡 Problema con Router',
                                    description: 'Router no funciona correctamente'
                                },
                                {
                                    id: 'antena_problema',
                                    title: '📡 Problema con Antena',
                                    description: 'No responde la antena'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(categoryMenu);
        return true;
    }

    /**
     * Maneja la selección de categoría
     */
    private async handleCategorySelection(user: User, message: string, session: SessionData): Promise<boolean> {
        const categoryNames: { [key: string]: string } = {
            'sin_internet': 'Sin Internet',
            'internet_lento': 'Internet Lento',
            'intermitente': 'Conexión Intermitente',
            'router_problema': 'Problema con Router',
            'antena_problema': 'No Responde La Antena'
        };

        if (!categoryNames[message]) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Opción no válida. Por favor, selecciona una opción del menú.');
            return true;
        }

        session.category = message;
        session.step = 'description';
        session.asunto = categoryNames[message];

        await this.messageService.sendTextMessage(user.phoneNumber,
            `📝 Seleccionaste: **${categoryNames[message]}**\n\n` +
            'Ahora describe brevemente tu problema para ayudarnos a entenderlo mejor:');

        return true;
    }

    /**
     * Maneja la entrada de descripción
     */
    private async handleDescriptionInput(user: User, message: string, session: SessionData): Promise<boolean> {
        if (message.length < 5) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Por favor, proporciona más detalles sobre tu problema.');
            return true;
        }

        session.description = message;

        try {
            // Crear ticket usando la API de WispHub
            const now = new Date();
            const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;            // Obtener ID de servicio del usuario
            const userData = this.decodeUserData(user);
            const serviceId = userData?.serviceId || "37"; // ID de servicio predeterminado si no está disponible

            const ticketData = new FormData();
            ticketData.append('asuntos_default', session.asunto || "Internet Lento");
            ticketData.append('asunto', session.asunto || "Internet Lento");            // Campo de técnico - REQUERIDO por WispHub API
            let technicianId = config.wisphub.defaultTechnicianId?.trim();
            if (!technicianId || technicianId === '') {
                technicianId = '417534'; // Usuario administrativo de Conecta2tel
                console.log('📋 Usando técnico por defecto (ID: 417534) - configura WISPHUB_DEFAULT_TECHNICIAN_ID para uno específico');
            } else {
                console.log('📋 Usando técnico configurado:', technicianId);
            }
            ticketData.append('tecnico', technicianId);

            ticketData.append('descripcion', `<p>${session.description}</p>`);
            ticketData.append('estado', "1");
            ticketData.append('prioridad', "1");
            ticketData.append('servicio', serviceId);
            ticketData.append('fecha_inicio', formattedDate);
            ticketData.append('fecha_final', formattedDate);
            ticketData.append('origen_reporte', "whatsapp");
            ticketData.append('departamento', "Soporte Técnico");
            ticketData.append('departamentos_default', "Soporte Técnico");
            // Realizar la petición a la API de WispHub
            const response = await axios.post(this.apiUrl, ticketData, {
                headers: {
                    'Authorization': this.apiKey
                    // No establecemos Content-Type, axios lo configura automáticamente con el boundary correcto para FormData
                }
            }); const ticketId = response.data?.id || "Pendiente";

            // Enviar confirmación exitosa
            await this.messageService.sendTextMessage(user.phoneNumber,
                '✅ **¡Reporte Recibido!**\n\n' +
                `🔍 **Ticket #:** ${ticketId}\n` +
                `📂 **Problema:** ${session.asunto}\n` +
                `📅 **Fecha:** ${now.toLocaleDateString('es-CO')}\n\n` +
                '👨‍💻 **Próximos pasos:**\n' +
                '• Tu reporte será atendido por nuestro equipo técnico\n' +
                '• Te contactaremos pronto para brindarte solución\n' +
                '• Tiempo estimado de respuesta: 2-4 horas\n\n' +
                '¡Gracias por reportar tu falla!');

            // Mostrar botones de navegación
            await this.messageService.sendNavigationButtons(
                user.phoneNumber,
                '🔧 Ticket Creado',
                '¿Qué deseas hacer ahora?'
            );

            // Limpiar estado de sesión
            this.resetTicketSession(session);

            return true;

        } catch (error) {
            console.error('Error al crear ticket en WispHub:', error);

            // Intento alternativo usando el servicio interno
            try {
                const ticketData = {
                    customerId: user.customerId!,
                    category: session.category || 'general',
                    description: session.description || 'Sin descripción',
                    priority: 'alta' as const,
                    source: 'whatsapp',
                    clientInfo: {
                        name: session.ticketData?.clientName,
                        phone: user.phoneNumber
                    }
                };

                await this.ticketService.createTicket(ticketData); await this.messageService.sendTextMessage(user.phoneNumber,
                    '✅ **¡Reporte Recibido!**\n\n' +
                    `📂 **Problema:** ${session.asunto}\n` +
                    `📅 **Fecha:** ${new Date().toLocaleDateString('es-CO')}\n\n` +
                    '👨‍💻 **Tu reporte será atendido por nuestro equipo técnico**\n\n' +
                    '¡Gracias por reportar tu falla!');

                // Mostrar botones de navegación
                await this.messageService.sendNavigationButtons(
                    user.phoneNumber,
                    '🔧 Ticket Creado',
                    '¿Qué deseas hacer ahora?'
                );

            } catch (innerError) {
                console.error('Error con sistema de tickets de respaldo:', innerError);
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Error al procesar tu reporte. Intenta nuevamente o contacta directamente a nuestro equipo de soporte al número 3242156679.');
            }

            // Limpiar estado de sesión
            this.resetTicketSession(session);
            return true;
        }
    }

    /**
     * Resetea el estado de sesión de tickets
     */
    private resetTicketSession(session: SessionData): void {
        session.creatingTicket = false;
        session.category = undefined;
        session.description = undefined;
        session.step = undefined;
        session.ticketData = undefined;
        session.asunto = undefined;
    }

    /**
     * Decodifica los datos del usuario desde la información almacenada
     * Método específico para el flujo de tickets
     */
    protected decodeUserData(user: User): any {
        if (!user.customerId) {
            return null;
        }

        try {
            // Intentar usar los datos de servicios del usuario primero
            if (user.userServices && user.userServices.length > 0) {
                const service = user.userServices[0];
                return {
                    id_servicio: service.id,
                    customerName: service.name,
                    status: service.status
                };
            }

            // Intentar usar el método de la clase base si hay datos encriptados
            if (user.encryptedData) {
                const baseData = super.decodeUserData(user);
                if (baseData) {
                    // Los datos ya deberían tener id_servicio desde la autenticación
                    if (!baseData.id_servicio && baseData.customerId) {
                        baseData.id_servicio = baseData.customerId;
                    }
                    return baseData;
                }
            }

            // Fallback
            return {
                id_servicio: user.customerId,
                customerName: "Usuario",
                status: "unknown"
            };
        } catch (error) {
            console.error('Error decodificando datos de usuario:', error);
            return {
                id_servicio: user.customerId,
                customerName: "Usuario",
                status: "unknown"
            };
        }
    }
}

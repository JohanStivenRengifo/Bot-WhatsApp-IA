import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, TicketService } from '../services';
import moment from 'moment';
import 'moment/locale/es'; // Importar configuración para español

// Configurar moment para usar español
moment.locale('es');

/**
 * Flujo para la creación de tickets de soporte
 */
export class TicketFlow extends BaseConversationFlow {
    readonly name: string = 'ticket';

    private ticketService: TicketService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        ticketService: TicketService
    ) {
        super(messageService, securityService);
        this.ticketService = ticketService;
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario está autenticado y ha solicitado crear un ticket
        // 2. El usuario está en proceso de creación de ticket
        return user.authenticated && (
            message.toLowerCase() === 'ticket' ||
            message.toLowerCase() === 'soporte' ||
            message === 'ticket' ||
            session.creatingTicket === true
        );
    }

    /**
     * Maneja el proceso de creación de tickets
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Verificar si el usuario tiene un servicio activo
            const userData = this.decodeUserData(user);
            if (userData?.isInactive) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '⚠️ Tu servicio está actualmente inactivo.\n\n' +
                    'Para reactivarlo y poder crear tickets de soporte técnico, primero debes regularizar tu cuenta.\n\n' +
                    'Te recomendamos:\n' +
                    '1️⃣ Verificar el estado de tu facturación\n' +
                    '2️⃣ Realizar el pago pendiente si lo hubiera\n' +
                    '3️⃣ Contactar a nuestro equipo de atención al cliente');
                return true;
            }

            // Si es la primera vez que entra al flujo de tickets
            if (!session.creatingTicket) {
                return await this.startTicketCreation(user, session);
            }

            // Si ya estaba en proceso de crear un ticket, continuar según el paso actual
            switch (session.step) {
                case 'category':
                    return await this.handleCategorySelection(user, message, session);
                case 'description':
                    return await this.handleDescriptionInput(user, message, session);
                default:
                    // Si no hay paso definido, reiniciar el flujo
                    return await this.startTicketCreation(user, session);
            }
        } catch (error) {
            console.error('Error en flujo de tickets:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error al crear el ticket. Por favor, intenta nuevamente en unos momentos.');
            return true;
        }
    }

    /**
     * Inicia el proceso de creación de tickets
     */
    private async startTicketCreation(user: User, session: SessionData): Promise<boolean> {
        // Obtener nombre del cliente para personalizar
        let clientName = "cliente";
        const userData = this.decodeUserData(user);
        if (userData?.customerName) {
            clientName = userData.customerName.split(' ')[0]; // Solo el primer nombre
        }

        session.creatingTicket = true;
        session.step = 'category';
        session.ticketData = {
            startTime: new Date(),
            clientName: clientName
        };

        const ticketMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🎫 Crear Ticket de Soporte'
                },
                body: {
                    text: `Hola ${clientName}, vamos a crear un ticket de soporte para solucionar tu problema lo antes posible.\n\nSelecciona el tipo de problema que estás experimentando:`
                },
                action: {
                    button: 'Seleccionar',
                    sections: [
                        {
                            title: 'Problemas Técnicos',
                            rows: [
                                {
                                    id: 'internet_lento',
                                    title: '🐌 Internet Lento',
                                    description: 'Velocidad menor a la contratada'
                                },
                                {
                                    id: 'sin_internet',
                                    title: '🚫 Sin Internet',
                                    description: 'No hay conexión a internet'
                                },
                                {
                                    id: 'intermitente',
                                    title: '📶 Conexión Intermitente',
                                    description: 'Se corta constantemente'
                                }
                            ]
                        },
                        {
                            title: 'Otros',
                            rows: [
                                {
                                    id: 'facturacion',
                                    title: '💰 Facturación',
                                    description: 'Problemas con cobros'
                                },
                                {
                                    id: 'otro',
                                    title: '❓ Otro',
                                    description: 'Problema diferente'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(ticketMenu);
        return true;
    }

    /**
     * Maneja la selección de categoría del ticket
     */
    private async handleCategorySelection(user: User, message: string, session: SessionData): Promise<boolean> {
        // Guardar la categoría seleccionada
        session.category = message;
        session.step = 'description';

        // Obtener el nombre amigable de la categoría
        const categoryNames: { [key: string]: string } = {
            'internet_lento': 'Internet Lento',
            'sin_internet': 'Sin Internet',
            'intermitente': 'Conexión Intermitente',
            'facturacion': 'Problema de Facturación',
            'otro': 'Otro Problema'
        };

        const categoryName = categoryNames[message] || 'Problema Técnico';

        await this.messageService.sendTextMessage(user.phoneNumber,
            `📝 Has seleccionado: *${categoryName}*\n\n` +
            `Ahora, por favor describe brevemente tu problema para que podamos ayudarte mejor:`);

        return true;
    }

    /**
     * Maneja la descripción del problema
     */
    private async handleDescriptionInput(user: User, message: string, session: SessionData): Promise<boolean> {
        // Guardar la descripción
        session.description = message;        // Datos para crear el ticket
        const ticketData = {
            customerId: user.customerId!,
            category: session.category!,
            description: session.description,
            source: 'whatsapp',
            priority: (session.category === 'sin_internet' ? 'alta' : 'media') as 'alta' | 'media' | 'baja'
        };

        try {            // Crear el ticket en el sistema
            const ticketId = await this.ticketService.createTicket(ticketData);

            // Enviar confirmación simplificada del ticket al usuario
            const ticketInfo =
                `✅ *TICKET CREADO EXITOSAMENTE*\n\n` +
                `🎫 *Ticket ID: #${ticketId}*\n` +
                `───────────────────────\n` +
                `📝 *Categoría:* ${this.getCategoryName(session.category!)}\n` +
                `📄 *Descripción:* ${session.description}\n` +
                `⚡ *Prioridad:* ${session.category === 'sin_internet' ? 'Alta' : 'Media'}\n` +
                `📅 *Creado:* ${moment().format('DD [de] MMMM [de] YYYY [a las] HH:mm')}\n\n` +
                `Un técnico revisará tu caso lo antes posible. Te mantendremos informado sobre el progreso a través de este chat.\n\n` +
                `Tiempo estimado de respuesta: ${this.getEstimatedTime(session.category === 'sin_internet' ? 'alta' : 'media')}\n\n` +
                `Escribe "estado" en cualquier momento para consultar el avance de tu ticket.`;

            await this.messageService.sendTextMessage(user.phoneNumber, ticketInfo);

            // Limpiar el estado de creación de ticket
            session.creatingTicket = false;
            session.step = undefined;
            session.category = undefined;
            session.description = undefined;

            // Opcional: Volver a mostrar el menú principal
            await this.messageService.sendMainMenu(user.phoneNumber);

            return true;
        } catch (error) {
            console.error('Error al crear ticket:', error);

            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, no pudimos crear tu ticket en este momento.\n\n' +
                'Por favor, intenta nuevamente más tarde o contacta directamente a nuestro servicio al cliente.');

            // Limpiar el estado de creación de ticket en caso de error
            session.creatingTicket = false;
            session.step = undefined;

            return true;
        }
    }

    /**
     * Obtiene el tiempo estimado de respuesta según la prioridad
     */
    private getEstimatedTime(priority: string): string {
        switch (priority.toLowerCase()) {
            case 'alta':
                return '1-2 horas';
            case 'media':
                return '4-6 horas';
            case 'baja':
                return '24 horas';
            default:
                return '12 horas';
        }
    }

    /**
     * Obtiene el nombre amigable de una categoría
     */
    private getCategoryName(categoryId: string): string {
        const categories: { [key: string]: string } = {
            'internet_lento': 'Internet Lento',
            'sin_internet': 'Sin Internet',
            'intermitente': 'Conexión Intermitente',
            'facturacion': 'Problema de Facturación',
            'otro': 'Otro Problema'
        };

        return categories[categoryId] || 'Problema Técnico';
    }
}
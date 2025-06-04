import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, TicketService } from '../services';

/**
 * Flujo especializado para creación de tickets con WispHub API
 */
export class TicketCreationFlow extends BaseConversationFlow {
    readonly name: string = 'ticketCreation';

    private ticketService: TicketService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        ticketService: TicketService
    ) {
        super(messageService, securityService);
        this.ticketService = ticketService;
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja:
        // 1. Cuando se selecciona "Crear Ticket" del menú de soporte
        // 2. Cuando está en proceso de creación de ticket
        return (
            user.authenticated &&
            (message === 'crear_ticket' ||
                message === 'ticket_creation' ||
                session.creatingTicket === true)
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
                    '3️⃣ Contactar a nuestro equipo de atención al cliente\n\n' +
                    'Escribe "reactivar" para más información.');
                return true;
            }

            if (!session.creatingTicket) {
                return await this.initializeTicketCreation(user, session);
            }

            // Procesar según el paso actual
            switch (session.step) {
                case 'category':
                    return await this.handleCategorySelection(user, message, session);
                case 'description':
                    return await this.handleDescriptionInput(user, message, session);
                case 'confirmation':
                    return await this.handleTicketConfirmation(user, message, session);
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
    }

    /**
     * Inicializa el proceso de creación de tickets
     */
    private async initializeTicketCreation(user: User, session: SessionData): Promise<boolean> {
        // Obtener nombre del cliente
        let clientName = "cliente";
        if (user.encryptedData) {
            try {
                const decryptedData = JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
                if (decryptedData.customerName) {
                    clientName = decryptedData.customerName.split(' ')[0];
                }
            } catch (error) {
                console.error('Error decrypting user data:', error);
            }
        }

        session.creatingTicket = true;
        session.step = 'category';
        session.ticketData = {
            startTime: new Date(),
            clientName: clientName
        };

        // Enviar menú de categorías mejorado
        const categoryMenu = {
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
                    text: `Hola ${clientName}, vamos a crear un ticket de soporte técnico para resolver tu problema.\n\n🔧 Selecciona la categoría que mejor describe tu situación:`
                },
                footer: {
                    text: 'Tu ticket será atendido por nuestro equipo especializado'
                },
                action: {
                    button: 'Seleccionar Categoría',
                    sections: [
                        {
                            title: 'Problemas de Conectividad',
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
                                    id: 'cables_dañados',
                                    title: '🔌 Cables Dañados',
                                    description: 'Problemas físicos de cableado'
                                }
                            ]
                        },
                        {
                            title: 'Otros Problemas',
                            rows: [
                                {
                                    id: 'configuracion',
                                    title: '⚙️ Configuración',
                                    description: 'Ayuda con configuración de red'
                                },
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
            'cables_dañados': 'Cables Dañados',
            'configuracion': 'Configuración de Red',
            'facturacion': 'Facturación',
            'otro': 'Otro Problema'
        };

        if (!categoryNames[message]) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Categoría no válida. Por favor, selecciona una opción del menú.');
            return true;
        }

        session.category = message;
        session.step = 'description';

        const categoryName = categoryNames[message];

        await this.messageService.sendTextMessage(user.phoneNumber,
            `📝 Perfecto, seleccionaste: **${categoryName}**\n\n` +
            'Ahora describe detalladamente tu problema:\n\n' +
            '💡 **Incluye información importante:**\n' +
            '• ¿Cuándo comenzó el problema?\n' +
            '• ¿Con qué frecuencia ocurre?\n' +
            '• ¿Qué has intentado hacer para solucionarlo?\n' +
            '• ¿Hay algún mensaje de error específico?\n' +
            '• ¿Afecta a todos los dispositivos o solo algunos?\n\n' +
            '✍️ Escribe tu descripción completa:');

        return true;
    }

    /**
     * Maneja la entrada de descripción
     */
    private async handleDescriptionInput(user: User, message: string, session: SessionData): Promise<boolean> {
        if (message.length < 10) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ La descripción es muy corta. Por favor, proporciona más detalles para que podamos ayudarte mejor.\n\n' +
                'Describe tu problema con al menos 10 caracteres:');
            return true;
        }

        session.description = message;
        session.step = 'confirmation';

        // Mostrar resumen y pedir confirmación
        const categoryNames: { [key: string]: string } = {
            'sin_internet': 'Sin Internet',
            'internet_lento': 'Internet Lento',
            'intermitente': 'Conexión Intermitente',
            'router_problema': 'Problema con Router',
            'cables_dañados': 'Cables Dañados',
            'configuracion': 'Configuración de Red',
            'facturacion': 'Facturación',
            'otro': 'Otro Problema'
        };

        const confirmationMessage = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '✅ Confirmar Ticket'
                },
                body: {
                    text: `📋 **Resumen del Ticket**\n\n` +
                        `👤 Cliente: ${session.ticketData?.clientName}\n` +
                        `📂 Categoría: ${categoryNames[session.category || 'otro']}\n` +
                        `📝 Descripción: ${session.description}\n\n` +
                        `¿Deseas crear este ticket de soporte?`
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'confirm_ticket',
                                title: '✅ Crear Ticket'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'cancel_ticket',
                                title: '❌ Cancelar'
                            }
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(confirmationMessage);
        return true;
    }

    /**
     * Maneja la confirmación del ticket
     */
    private async handleTicketConfirmation(user: User, message: string, session: SessionData): Promise<boolean> {
        if (message === 'cancel_ticket') {
            this.resetTicketSession(session);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Creación de ticket cancelada.\n\n' +
                'Si necesitas ayuda más tarde, puedes crear un nuevo ticket desde el menú de soporte técnico.');
            return true;
        }

        if (message === 'confirm_ticket') {
            try {
                // Crear ticket usando WispHub API
                const ticketData = {
                    customerId: user.customerId!,
                    category: session.category || 'general',
                    description: session.description || 'Sin descripción',
                    priority: 'media' as const,
                    source: 'whatsapp',
                    clientInfo: {
                        name: session.ticketData?.clientName,
                        phone: user.phoneNumber
                    }
                };

                const ticketId = await this.ticketService.createTicket(ticketData);

                // Enviar confirmación exitosa
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '🎉 **¡Ticket Creado Exitosamente!**\n\n' +
                    `🔍 **Ticket ID:** ${ticketId}\n` +
                    `📂 **Categoría:** ${this.getCategoryDisplayName(session.category || 'general')}\n` +
                    `📅 **Fecha:** ${new Date().toLocaleDateString('es-CO')}\n\n` +
                    '👨‍💻 **Próximos Pasos:**\n' +
                    '• Tu ticket será revisado por nuestro equipo técnico\n' +
                    '• Recibirás actualizaciones por WhatsApp\n' +
                    '• Tiempo estimado de respuesta: 2-4 horas\n' +
                    '• Para consultar el estado, escribe "estado ticket"\n\n' +
                    '📞 **¿Necesitas atención urgente?** Escribe "emergencia" para soporte inmediato.');

                // Notificar internamente sobre el nuevo ticket
                await this.ticketService.notifyNewTicket(ticketId, user.customerId!);

                // Limpiar estado de sesión
                this.resetTicketSession(session);

                return true;

            } catch (error) {
                console.error('Error creating ticket:', error);
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ Error al crear el ticket. Por favor, intenta nuevamente en unos minutos.\n\n' +
                    'Si el problema persiste, contacta directamente a nuestro equipo de soporte.');

                this.resetTicketSession(session);
                return true;
            }
        }

        // Mensaje no reconocido en confirmación
        await this.messageService.sendTextMessage(user.phoneNumber,
            '❓ No entendí tu respuesta. Por favor, selecciona una de las opciones del menú.');
        return true;
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
    }

    /**
     * Obtiene el nombre de visualización de una categoría
     */
    private getCategoryDisplayName(category: string): string {
        const categoryNames: { [key: string]: string } = {
            'sin_internet': 'Sin Internet',
            'internet_lento': 'Internet Lento',
            'intermitente': 'Conexión Intermitente',
            'router_problema': 'Problema con Router',
            'cables_dañados': 'Cables Dañados',
            'configuracion': 'Configuración de Red',
            'facturacion': 'Facturación',
            'otro': 'Otro Problema',
            'general': 'Problema General'
        };

        return categoryNames[category] || 'Problema Técnico';
    }
}

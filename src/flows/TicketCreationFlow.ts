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
        // Si el flujo ya está activo (activado por ClientMenuFlow)
        if (session.flowActive === 'ticketCreation') {
            return user.authenticated;
        }

        // Normalizar el mensaje para facilitar la comparación
        const extractedCommand = extractMenuCommand(message);
        const messageLower = message.toLowerCase().trim();

        // NO interceptar comandos de agente (estos deben ir a AgentHandoverFlow)
        if (extractedCommand === 'hablar_agente' || extractedCommand === 'agente' ||
            messageLower.includes('asesor') || messageLower.includes('agente') ||
            messageLower.includes('hablar con agente')) {
            return false;
        }

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
            }            // Procesar según el paso actual
            switch (session.step) {
                case 'category':
                    return await this.handleCategorySelection(user, message, session);
                case 'self_help_response':
                    return await this.handleSelfHelpResponse(user, message, session);
                case 'self_help_step2':
                    return await this.handleSelfHelpStep2(user, message, session);
                case 'problem_persists':
                    return await this.handleProblemPersists(user, message, session);
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
        let clientName = "cliente"; if (userData && userData.customerName && typeof userData.customerName === 'string') {
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
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(categoryMenu);
        return true;
    }    /**
     * Maneja la selección de categoría
     */
    private async handleCategorySelection(user: User, message: string, session: SessionData): Promise<boolean> {
        const categoryNames: { [key: string]: string } = {
            'sin_internet': 'Sin Internet',
            'internet_lento': 'Internet Lento',
            'intermitente': 'Conexión Intermitente',
            'router_problema': 'Problema con Router'
        };

        // Mapeo inteligente de mensajes completos a categorías
        let selectedCategory = message;
        const messageText = message.toLowerCase().trim();

        // Detectar categoría basada en texto completo o emojis
        if (messageText.includes('sin internet') || messageText.includes('🚫') || messageText.includes('no hay conexión')) {
            selectedCategory = 'sin_internet';
        } else if (messageText.includes('internet lento') || messageText.includes('🐌') || messageText.includes('velocidad menor')) {
            selectedCategory = 'internet_lento';
        } else if (messageText.includes('intermitente') || messageText.includes('📶') || messageText.includes('se corta')) {
            selectedCategory = 'intermitente';
        } else if (messageText.includes('router') || (messageText.includes('📡') && messageText.includes('router'))) {
            selectedCategory = 'router_problema';
        } else if (!categoryNames[selectedCategory]) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Opción no válida. Por favor, selecciona una opción del menú interactivo.');
            return true;
        }

        const categoryDisplayName = categoryNames[selectedCategory];
        session.category = selectedCategory;
        session.asunto = categoryDisplayName;

        // Mostrar consejos de autoayuda (Primera ronda)
        const selfHelpTips = this.getSelfHelpTips(selectedCategory);

        await this.messageService.sendTextMessage(user.phoneNumber,
            `📝 Seleccionaste: **${categoryDisplayName}**\n\n` +
            '💡 **Vamos a intentar resolver tu problema paso a paso:**\n\n' +
            selfHelpTips);

        // Enviar botones interactivos para la primera respuesta
        const firstStepButtons = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '🔧 Paso 1 - Diagnóstico Inicial'
                },
                body: {
                    text: '¿Ya probaste estos pasos? Selecciona tu respuesta:'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'tried_yes',
                                title: '✅ Sí, los probé'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'tried_no',
                                title: '❌ No los probé'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'problem_solved',
                                title: '🎉 ¡Funcionó!'
                            }
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(firstStepButtons);
        session.step = 'self_help_response';
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
    }    /**
     * Resetea el estado de sesión de tickets
     */
    private resetTicketSession(session: SessionData): void {
        session.creatingTicket = false;
        session.category = undefined;
        session.description = undefined;
        session.step = undefined;
        session.ticketData = undefined;
        session.asunto = undefined;
        session.flowActive = ''; // Limpiar estado de flujo activo
    }/**
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
    }    /**
     * Maneja la respuesta del usuario a los consejos de autoayuda (Primera ronda)
     */
    private async handleSelfHelpResponse(user: User, message: string, session: SessionData): Promise<boolean> {
        const messageText = message.toLowerCase().trim();        // Detectar respuesta por ID de botón o texto (incluyendo emojis)
        if (messageText.includes('problem_solved') || messageText.includes('solucionado') ||
            messageText.includes('resuelto') || messageText.includes('funciona') ||
            messageText.includes('se solucionó') || messageText.includes('🎉') ||
            messageText.includes('funcionó') || messageText.includes('ya funciona')) {
            // El problema se resolvió
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🎉 **¡Fantástico! Me alegra saber que se resolvió tu problema.**\n\n' +
                '✅ Los consejos de autoayuda funcionaron perfectamente.\n\n' +
                'Si tienes otro problema en el futuro, no dudes en contactarnos. Escribe **"menu"** para ver todas las opciones disponibles.');

            this.resetTicketSession(session);
            return true;
        } if (messageText.includes('tried_no') || messageText.includes('no') ||
            messageText.includes('no los he probado') || messageText.includes('no he probado') ||
            messageText.includes('❌') || messageText.includes('no los probé')) {
            // El usuario no ha probado los consejos
            await this.messageService.sendTextMessage(user.phoneNumber,
                '👍 **¡Perfecto! Vamos a intentar resolver tu problema.**\n\n' +
                '⏰ Por favor, sigue los pasos que te compartí e intenta conectarte nuevamente.\n\n' +
                '🕐 **Tiempo recomendado:** Tómate 5-10 minutos para seguir cada paso correctamente.');

            // Enviar botones para después de intentar
            const waitingButtons = {
                messaging_product: 'whatsapp',
                to: user.phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: {
                        type: 'text',
                        text: '⏳ Después de intentar los pasos...'
                    },
                    body: {
                        text: 'Una vez que hayas seguido todos los pasos, selecciona el resultado:'
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: {
                                    id: 'steps_worked',
                                    title: '✅ ¡Funcionó!'
                                }
                            }, {
                                type: 'reply',
                                reply: {
                                    id: 'steps_failed',
                                    title: '❌ No funcionó'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'need_help',
                                    title: '❓ Necesito ayuda'
                                }
                            }
                        ]
                    }
                }
            };

            await this.messageService.sendMessage(waitingButtons);
            session.step = 'self_help_step2';
            return true;
        } if (messageText.includes('tried_yes') || messageText.includes('sí') || messageText.includes('si') ||
            messageText.includes('los probé') || messageText.includes('ya probé') ||
            messageText.includes('✅') || messageText.includes('ya intenté')) {
            // El usuario ya probó pero el problema persiste - Segunda ronda
            const advancedTips = this.getAdvancedSelfHelpTips(session.category!);

            await this.messageService.sendTextMessage(user.phoneNumber,
                '🔍 **Veo que ya intentaste los pasos básicos.**\n\n' +
                '💡 **Probemos con estos pasos más avanzados:**\n\n' +
                advancedTips);

            // Enviar botones para la segunda ronda
            const secondStepButtons = {
                messaging_product: 'whatsapp',
                to: user.phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: {
                        type: 'text',
                        text: '🔧 Paso 2 - Diagnóstico Avanzado'
                    },
                    body: {
                        text: 'Después de probar estos pasos avanzados:'
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: {
                                    id: 'advanced_worked',
                                    title: '✅ ¡Ahora funciona!'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'still_broken',
                                    title: '❌ Aún no funciona'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'too_complex',
                                    title: '🤔 Es muy complejo'
                                }
                            }
                        ]
                    }
                }
            };

            await this.messageService.sendMessage(secondStepButtons); session.step = 'self_help_step2';
            return true;
        }

        // Respuesta no reconocida - dar más opciones al usuario
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🤔 **No reconocí tu respuesta.**\n\n' +
            '💡 **Puedes:**\n' +
            '• Usar los botones que aparecen arriba\n' +
            '• Escribir **"menu"** para volver al menú principal\n' +
            '• Escribir **"sí"** si ya probaste los pasos\n' +
            '• Escribir **"no"** si no los has probado\n' +
            '• Escribir **"funcionó"** si se resolvió tu problema');

        return true;
    }

    /**
     * Maneja la segunda ronda de autoayuda
     */
    private async handleSelfHelpStep2(user: User, message: string, session: SessionData): Promise<boolean> {
        const messageText = message.toLowerCase().trim(); if (messageText.includes('steps_worked') || messageText.includes('advanced_worked') ||
            messageText.includes('funcionó') || messageText.includes('ahora funciona') ||
            messageText.includes('✅') || messageText.includes('ya funciona') ||
            messageText.includes('se arregló') || messageText.includes('solucionó')) {
            // El problema se resolvió en la segunda ronda
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🎉 **¡Excelente! Me alegra que hayas podido resolver el problema.**\n\n' +
                '✅ Los pasos de diagnóstico funcionaron correctamente.\n\n' +
                '📚 **Tip:** Guarda estos pasos para futuras referencias. Si vuelves a tener problemas similares, ya sabes cómo resolverlos.\n\n' +
                'Escribe **"menu"** para volver al menú principal.');

            this.resetTicketSession(session);
            return true;
        } if (messageText.includes('steps_failed') || messageText.includes('still_broken') ||
            messageText.includes('sigue sin funcionar') || messageText.includes('aún no funciona') ||
            messageText.includes('too_complex') || messageText.includes('es muy complejo') ||
            messageText.includes('❌') || messageText.includes('no funciona') ||
            messageText.includes('sigue igual') || messageText.includes('nada')) {
            // El problema persiste después de dos rondas
            await this.messageService.sendTextMessage(user.phoneNumber,
                '😔 **Entiendo tu frustración. Has intentado resolver el problema por tu cuenta.**\n\n' +
                '👨‍💻 **Es momento de que nuestro equipo técnico te ayude directamente.**\n\n' +
                '📋 Para crear un reporte de soporte técnico, necesitamos conocer más detalles del problema.');

            // Botones finales antes de crear ticket
            const finalButtons = {
                messaging_product: 'whatsapp',
                to: user.phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: {
                        type: 'text',
                        text: '🎫 Crear Reporte de Soporte'
                    },
                    body: {
                        text: '¿Estás listo para reportar tu problema a nuestro equipo técnico?'
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply', reply: {
                                    id: 'create_report',
                                    title: '📝 Crear reporte'
                                }
                            },
                            {
                                type: 'reply', reply: {
                                    id: 'try_later',
                                    title: '⏰ Después'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'back_menu',
                                    title: '🏠 Volver al menú'
                                }
                            }
                        ]
                    }
                }
            };

            await this.messageService.sendMessage(finalButtons);
            session.step = 'problem_persists';
            return true;
        }

        if (messageText.includes('need_help') || messageText.includes('necesito ayuda') ||
            messageText.includes('❓') || messageText.includes('no entiendo') ||
            messageText.includes('ayuda') || messageText.includes('explicar')) {
            // El usuario necesita ayuda con los pasos
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🤝 **¡Por supuesto! Te ayudo a entender mejor los pasos.**\n\n' +
                'Vamos a revisar los pasos uno por uno para que sea más fácil:');

            const simplifiedTips = this.getSimplifiedSelfHelpTips(session.category!);
            await this.messageService.sendTextMessage(user.phoneNumber, simplifiedTips);

            // Botones después de explicación simplificada
            const helpButtons = {
                messaging_product: 'whatsapp',
                to: user.phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: {
                        type: 'text',
                        text: '🔧 Con esta explicación...'
                    },
                    body: {
                        text: 'Ahora que tienes una explicación más detallada:'
                    },
                    action: {
                        buttons: [
                            {
                                type: 'reply', reply: {
                                    id: 'understood_trying',
                                    title: '👍 Voy a intentar'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'still_complex',
                                    title: '😕 Aún es complejo'
                                }
                            }
                        ]
                    }
                }
            };

            await this.messageService.sendMessage(helpButtons);
            return true;
        }

        if (messageText.includes('understood_trying') || messageText.includes('voy a intentar')) {
            // Usuario va a intentar con la explicación simplificada
            await this.messageService.sendTextMessage(user.phoneNumber,
                '💪 **¡Perfecto! Tómate tu tiempo y sigue cada paso.**\n\n' +
                '⏰ Cuando termines, vuelve y cuéntame cómo te fue escribiendo **"funcionó"** o **"no funcionó"**.');

            return true;
        } if (messageText.includes('still_complex') || messageText.includes('aún es complejo')) {
            // Es muy complejo, ir directo a crear ticket
            session.step = 'problem_persists';
            return await this.handleProblemPersists(user, 'create_report', session);
        }

        // Respuesta no reconocida - dar opciones más claras
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🤔 **No reconocí tu respuesta.**\n\n' +
            '💡 **Puedes escribir:**\n' +
            '• **"funcionó"** si los pasos resolvieron tu problema\n' +
            '• **"no funcionó"** si sigues teniendo problemas\n' +
            '• **"es complejo"** si necesitas ayuda con los pasos\n' +
            '• **"menu"** para volver al menú principal');

        return true;
    }

    /**
     * Maneja cuando el problema persiste y es necesario crear ticket
     */    private async handleProblemPersists(user: User, message: string, session: SessionData): Promise<boolean> {
        const messageText = message.toLowerCase().trim();

        if (messageText.includes('create_report') || messageText.includes('crear reporte') ||
            messageText.includes('📝 crear reporte')) {
            // Proceder a crear el ticket
            session.step = 'description';
            await this.messageService.sendTextMessage(user.phoneNumber,
                '📝 **Perfecto. Vamos a crear tu reporte de soporte técnico.**\n\n' +
                '💡 **Para ayudarte mejor, describe detalladamente:**\n' +
                '• ¿Cuándo comenzó el problema?\n' +
                '• ¿Qué pasos ya intentaste?\n' +
                '• ¿El problema es constante o intermitente?\n' +
                '• ¿Hay algún detalle adicional que debamos saber?\n\n' +
                '✍️ **Escribe tu descripción:**');
            return true;
        }

        if (messageText.includes('try_later') || messageText.includes('intentaré después') ||
            messageText.includes('⏰ después') || messageText.includes('después')) {
            // Usuario quiere intentar después
            await this.messageService.sendTextMessage(user.phoneNumber,
                '⏰ **Perfecto, tómate tu tiempo.**\n\n' +
                '💡 **Recuerda:** Puedes volver en cualquier momento escribiendo:\n' +
                '• **"soporte"** - Para volver a este proceso\n' +
                '• **"menu"** - Para ver todas las opciones\n\n' +
                '📞 **Si es urgente:** Puedes llamar al **3242156679**');

            // Enviar botones de navegación después de posponer
            await this.messageService.sendNavigationButtons(
                user.phoneNumber,
                '🕐 Puedes volver cuando quieras',
                '¿Qué deseas hacer ahora?'
            );

            this.resetTicketSession(session);
            return true;
        } if (messageText.includes('back_menu') || messageText.includes('volver al menú') ||
            messageText.includes('🏠 volver al menú')) {
            // Volver al menú principal
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🏠 **Regresando al menú principal.**\n\n' +
                'Escribe **"menu"** para ver todas las opciones disponibles.');

            this.resetTicketSession(session);
            return true;
        }

        // Respuesta no reconocida - dar opciones específicas para esta situación
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🤔 **No reconocí tu respuesta.**\n\n' +
            '💡 **Puedes escribir:**\n' + '• **"crear reporte"** para reportar tu problema\n' +
            '• **"después"** para intentar más tarde\n' +
            '• **"menu"** para volver al menú principal\n' +
            '• **"ayuda"** para hablar con un agente');

        return true;
    }

    /**
     * Proporciona consejos básicos de autoayuda según la categoría del problema
     */
    private getSelfHelpTips(category: string): string {
        switch (category) {
            case 'sin_internet':
                return '🔌 **Sin Internet - Pasos Básicos:**\n' +
                    '1️⃣ **Verifica las luces:** ¿El router tiene luces encendidas?\n' +
                    '2️⃣ **Reinicia el router:** Desconecta 30 segundos y vuelve a conectar\n' +
                    '3️⃣ **Espera 3 minutos:** Dale tiempo al equipo para conectarse\n' +
                    '4️⃣ **Prueba con tu celular:** ¿Se conecta al WiFi?\n' +
                    '5️⃣ **Revisa cables:** ¿Están bien conectados y sin daños?';

            case 'internet_lento':
                return '🐌 **Internet Lento - Soluciones Rápidas:**\n' +
                    '1️⃣ **Cierra aplicaciones:** Que no estés usando en tu celular\n' +
                    '2️⃣ **Acércate al router:** La señal WiFi es más fuerte cerca\n' +
                    '3️⃣ **Limita dispositivos:** Desconecta aparatos que no uses\n' +
                    '4️⃣ **Reinicia el router:** Desconecta 30 segundos\n' +
                    '5️⃣ **Prueba con cable:** Conecta directo al router si puedes';

            case 'intermitente':
                return '📶 **Conexión Intermitente - Verificaciones:**\n' +
                    '1️⃣ **Observa las luces:** ¿Se apagan y encienden?\n' +
                    '2️⃣ **Revisa la ventilación:** ¿El router está muy caliente?\n' +
                    '3️⃣ **Aleja interferencias:** Microondas, radios, otros routers\n' +
                    '4️⃣ **Verifica cables:** ¿Están sueltos o apretados?\n' +
                    '5️⃣ **Reinicia completamente:** Desconecta todo por 2 minutos';

            case 'router_problema':
                return '📡 **Problema con Router - Diagnóstico:**\n' +
                    '1️⃣ **Revisa las luces:** ¿Qué colores ves? ¿Parpadean?\n' +
                    '2️⃣ **Verifica la alimentación:** ¿El cable de poder está bien?\n' +
                    '3️⃣ **Prueba otros puertos:** Si tienes cable ethernet\n' +
                    '4️⃣ **Reinicia por completo:** Desconecta todo por 3 minutos\n' +
                    '5️⃣ **Temperatura:** ¿Está muy caliente el equipo?';

            default:
                return '🔧 **Pasos Básicos Generales:**\n' +
                    '1️⃣ Reinicia todos los equipos de red\n' +
                    '2️⃣ Espera al menos 3 minutos\n' +
                    '3️⃣ Verifica que todos los cables estén conectados\n' +
                    '4️⃣ Prueba desde diferentes dispositivos\n' +
                    '5️⃣ Anota cuándo ocurre exactamente el problema';
        }
    }

    /**
     * Proporciona consejos avanzados de autoayuda según la categoría del problema
     */
    private getAdvancedSelfHelpTips(category: string): string {
        switch (category) {
            case 'sin_internet':
                return '🔍 **Sin Internet - Diagnóstico Avanzado:**\n' +
                    '1️⃣ **Verifica el cable de red:** Revisa que no esté doblado o con mordidas\n' +
                    '2️⃣ **Prueba otro cable ethernet** si tienes uno disponible\n' +
                    '3️⃣ **Reinicia desde el módem:** Desconecta TODO por 2 minutos\n' +
                    '4️⃣ **Conecta directo al módem:** Usa cable, no WiFi\n' +
                    '5️⃣ **Revisa el clima:** ¿Hay lluvia fuerte o viento?\n' +
                    '6️⃣ **Verifica otros dispositivos:** ¿Ninguno tiene internet?';

            case 'internet_lento':
                return '⚡ **Internet Lento - Optimización Avanzada:**\n' +
                    '1️⃣ **Test de velocidad:** Haz una prueba en fast.com\n' +
                    '2️⃣ **Cambia de canal WiFi:** Busca "192.168.1.1" en tu navegador\n' +
                    '3️⃣ **Ubica el router mejor:** Lejos de microondas y paredes gruesas\n' +
                    '4️⃣ **Limita dispositivos:** Desconecta aparatos que no uses\n' +
                    '5️⃣ **Actualiza dispositivo:** Reinicia tu celular/computador\n' +
                    '6️⃣ **Horario de prueba:** Prueba en diferentes horarios';

            case 'intermitente':
                return '🔄 **Conexión Intermitente - Diagnóstico Profundo:**\n' +
                    '1️⃣ **Supervisa las luces:** Anota cuándo se apagan/encienden\n' +
                    '2️⃣ **Verifica temperatura:** ¿El router está muy caliente?\n' +
                    '3️⃣ **Prueba con cable:** ¿También se corta por cable ethernet?\n' +
                    '4️⃣ **Revisa la alimentación:** ¿El cable de poder está suelto?\n' +
                    '5️⃣ **Interferencias:** Aleja celulares, radios, otros routers\n' +
                    '6️⃣ **Reset de fábrica:** Botón reset por 10 segundos (último recurso)';

            case 'router_problema':
                return '🔧 **Router - Diagnóstico Técnico:**\n' +
                    '1️⃣ **Documenta las luces:** Apunta colores y patrones de parpadeo\n' +
                    '2️⃣ **Verifica voltaje:** ¿El adaptador de poder es el original?\n' +
                    '3️⃣ **Test de puertos:** Prueba diferentes puertos ethernet\n' +
                    '4️⃣ **Reset completo:** Desconecta TODO, espera 5 minutos\n' +
                    '5️⃣ **Configuración web:** Accede a 192.168.1.1 desde navegador\n' +
                    '6️⃣ **Historial de problemas:** ¿Cuándo comenzó exactamente?';

            default:
                return '🔧 **Diagnóstico Avanzado General:**\n' +
                    '1️⃣ Documenta exactamente cuándo ocurre el problema\n' +
                    '2️⃣ Prueba en diferentes horarios del día\n' +
                    '3️⃣ Verifica si afecta a todos los dispositivos\n' +
                    '4️⃣ Anota cualquier cambio reciente en tu configuración';
        }
    }

    /**
     * Proporciona explicaciones simplificadas de los pasos
     */
    private getSimplifiedSelfHelpTips(category: string): string {
        switch (category) {
            case 'sin_internet':
                return '🔌 **Pasos Simples - Sin Internet:**\n\n' +
                    '**Paso 1:** Busca la "cajita" del internet (router)\n' +
                    '**Paso 2:** ¿Hay luces encendidas? Deben ser verdes o azules\n' +
                    '**Paso 3:** Desconecta el cable de la corriente por 30 segundos\n' +
                    '**Paso 4:** Vuelve a conectar y espera 3 minutos\n' +
                    '**Paso 5:** Intenta conectarte desde tu celular\n\n' +
                    '💡 **Si no funciona:** Revisa que todos los cables estén bien conectados';

            case 'internet_lento':
                return '🐌 **Pasos Simples - Internet Lento:**\n\n' +
                    '**Paso 1:** Cierra aplicaciones de tu celular que no uses\n' +
                    '**Paso 2:** Acércate al router (la cajita del WiFi)\n' +
                    '**Paso 3:** Apaga la TV o computador si están viendo videos\n' +
                    '**Paso 4:** Reinicia el router (desconectar/conectar)\n' +
                    '**Paso 5:** Espera 3 minutos y prueba navegar\n\n' +
                    '💡 **Importante:** Entre menos dispositivos conectados, más rápido va';

            case 'intermitente':
                return '📶 **Pasos Simples - Se Corta la Conexión:**\n\n' +
                    '**Paso 1:** Observa las luces del router cuando se corta\n' +
                    '**Paso 2:** Verifica que el router tenga ventilación (no esté tapado)\n' +
                    '**Paso 3:** Aleja el router de otros aparatos electrónicos\n' +
                    '**Paso 4:** Revisa que los cables no estén apretados o doblados\n' +
                    '**Paso 5:** Reinicia y observa si vuelve a cortarse\n\n' +
                    '💡 **Dato:** Si se corta siempre a la misma hora, avísanos';

            default:
                return '🔧 **Pasos Generales Simplificados:**\n\n' +
                    '**Paso 1:** Reinicia tu router (desconectar y conectar)\n' +
                    '**Paso 2:** Espera 3 minutos completos\n' +
                    '**Paso 3:** Prueba desde diferentes dispositivos\n' +
                    '**Paso 4:** Anota a qué hora ocurre el problema\n\n' +
                    '💡 **Recuerda:** La paciencia es clave, dale tiempo al equipo';
        }
    }
}

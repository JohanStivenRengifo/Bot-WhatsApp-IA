import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';

/**
 * Flujo de soporte técnico mejorado con menú principal
 */export class TechnicalSupportFlow extends BaseConversationFlow {
    readonly name: string = 'technicalSupport';

    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Solo manejar si:
        // 1. Usuario no autenticado solicita soporte
        // 2. Usuario autenticado selecciona opciones del menú de soporte técnico
        // 3. Usuario autenticado dice "soporte" directamente
        return (
            // Usuario no autenticado solicita soporte
            (!user.authenticated && (
                message.toLowerCase().includes('soporte') ||
                session.selectedService === 'soporte'
            )) ||
            // Usuario autenticado en flujo de soporte técnico con selección válida del menú
            (user.authenticated &&
                session.flowActive === 'technicalSupport' &&
                this.isMenuSelection(message)) ||
            // Usuario autenticado solicita soporte nuevamente
            (user.authenticated &&
                message.toLowerCase() === 'soporte' &&
                session.flowActive !== 'technicalSupport')
        );
    }    /**
     * Maneja el flujo de soporte técnico
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Si no está autenticado, redirigir al flujo de autenticación
            if (!user.authenticated) {
                session.selectedService = 'soporte';
                user.hasSelectedService = true;

                await this.messageService.sendTextMessage(user.phoneNumber,
                    '🔧 ¡Perfecto! Te ayudaré con el soporte técnico.\n\n' +
                    '🔐 Para acceder a nuestros servicios de soporte, necesito verificar tu identidad.\n\n' +
                    'Por favor, ingresa tu número de documento (cédula):');

                // El flujo de autenticación se encargará del resto
                return false; // Permitir que otro flujo maneje la autenticación
            }

            // Si está autenticado y es una respuesta del menú, procesarla
            if (this.isMenuSelection(message)) {
                return await this.handleMenuSelection(user, message, session);
            }

            // Si es solicitud inicial de soporte, mostrar el menú
            if (message.toLowerCase() === 'soporte') {
                session.flowActive = 'technicalSupport';
                await this.showTechnicalSupportMenu(user);
                return true;
            }

            // Si llegamos aquí, no es una selección válida
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❓ No entendí tu mensaje. Te muestro el menú de soporte técnico:');
            await this.showTechnicalSupportMenu(user);
            return true;

        } catch (error) {
            console.error('Error en flujo de soporte técnico:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Por favor, intenta nuevamente.');
            return true;
        }
    }    /**
     * Muestra el menú principal de soporte técnico
     */
    private async showTechnicalSupportMenu(user: User): Promise<void> {
        // Obtener datos del usuario para personalizar
        let userName = 'Cliente';
        const userData = this.decodeUserData(user);
        if (userData?.customerName) {
            userName = userData.customerName.split(' ')[0];
        }

        const supportMenu = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🔧 Soporte Técnico Conecta2'
                },
                body: {
                    text: `¡Hola ${userName}! 😊\n\n¿En qué puedo ayudarte hoy? Selecciona una opción:`
                },
                action: {
                    button: 'Ver opciones',
                    sections: [
                        {
                            title: 'Consultas Financieras',
                            rows: [
                                {
                                    id: 'facturas_deudas',
                                    title: '📄 Consultar Facturas',
                                    description: 'Ver facturas y estado de cuenta'
                                },
                                {
                                    id: 'consultar_deuda',
                                    title: '💰 Consultar Deuda',
                                    description: 'Ver saldo pendiente'
                                }
                            ]
                        },
                        {
                            title: 'Soporte Técnico',
                            rows: [
                                {
                                    id: 'crear_ticket',
                                    title: '🎫 Reportar Problema',
                                    description: 'Crear ticket de soporte técnico'
                                },
                                {
                                    id: 'ping_ip',
                                    title: '📡 Test de Conexión',
                                    description: 'Verificar tu conexión'
                                }
                            ]
                        },
                        {
                            title: 'Gestión de Cuenta',
                            rows: [
                                {
                                    id: 'cambiar_password',
                                    title: '🔐 Cambiar Contraseña',
                                    description: 'Solicitar cambio de contraseña'
                                },
                                {
                                    id: 'mejorar_plan',
                                    title: '⬆️ Mejorar Plan',
                                    description: 'Cambiar o mejorar tu plan actual'
                                }
                            ]
                        },
                        {
                            title: 'Pagos',
                            rows: [
                                {
                                    id: 'puntos_pago',
                                    title: '🏦 Puntos de Pago',
                                    description: 'Ubicaciones y cuentas bancarias'
                                },
                                {
                                    id: 'comprobante_pago',
                                    title: '💳 Enviar Comprobante',
                                    description: 'Subir comprobante de pago'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(supportMenu);
    }    /**
     * Verifica si el mensaje es una selección del menú interactivo
     */    
     private isMenuSelection(message: string): boolean {
         // Solo IDs exactos del menú interactivo o texto específico de los botones
         const menuOptions = [
             'facturas_deudas', 'consultar_deuda', 'crear_ticket', 'ping_ip',
             'cambiar_password', 'comprobante_pago', 'mejorar_plan',
             'puntos_pago'
         ];
     
         const lowercaseMessage = message.toLowerCase().trim();
     
         // Verificar IDs exactos primero
         if (menuOptions.includes(lowercaseMessage)) {
             return true;
         }        
         
         // Verificar textos exactos de los títulos del menú
         const menuTitles = [
             '📄 facturas y deudas',
             '🎫 reportar problema',
             '📡 verificar conexión',
             '🔐 cambiar contraseña',
             '💳 enviar comprobante',
             '⬆️ mejorar plan',
             '🏦 puntos de pago'
         ];
     
         // Verificar coincidencias parciales con los títulos
         if (menuTitles.some(title =>
             lowercaseMessage.includes(title.toLowerCase()) ||
             title.toLowerCase().includes(lowercaseMessage)
         )) {
             return true;
         }
         
         // Verificar variantes comunes de "crear ticket" o "reportar problema"
         const ticketVariants = [
             'crear ticket', 'rear ticket', 'reportar problema', 'reportar falla',
             'ticket', 'problema técnico', 'reportar problemas técnicos'
         ];
         
         return ticketVariants.some(variant => lowercaseMessage.includes(variant));
     }    /**
     * Procesa la selección del usuario desde el menú
     */
    private async handleMenuSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        const selection = message.toLowerCase().trim();

        // Limpiar el flowActive para permitir que otros flujos tomen el control
        session.flowActive = '';

        try {
            if (selection.includes('facturas') || selection.includes('deudas') || selection === 'facturas_deudas') {
                // Activar flag para facturas
                session.consultingInvoices = true;
                return false; // Permitir que InvoicesFlow maneje esto
            }

            else if (selection.includes('consultar_deuda') || selection === 'consultar_deuda') {
                // Obtener información de deuda del cliente
                try {
                    const debtInfo = await this.customerService.getCustomerDebt(user.customerId!);

                    if (!debtInfo) {
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '❌ Lo siento, no pude obtener la información de tu deuda en este momento.\n\n' +
                            'Por favor, intenta nuevamente más tarde o contacta a nuestro servicio al cliente.');
                        return true;
                    }

                    let debtMessage = '';
                    if (debtInfo.totalDebt === 0) {
                        debtMessage = '✅ *¡Felicitaciones!*\n\n' +
                            '🎉 No tienes deudas pendientes\n' +
                            '📊 Tu cuenta está al día';
                    } else {
                        debtMessage = `💰 *Resumen de Deuda*\n\n` +
                            `🔴 Total adeudado: $${debtInfo.totalDebt.toLocaleString()}\n` +
                            `📄 Facturas pendientes: ${debtInfo.pendingInvoices}\n` +
                            `📅 Próxima fecha límite: ${debtInfo.nextDueDate ? new Date(debtInfo.nextDueDate).toLocaleDateString() : 'No disponible'}\n\n` +
                            `💡 Paga antes del vencimiento para evitar suspensión del servicio.`;
                    }

                    await this.messageService.sendTextMessage(user.phoneNumber, debtMessage);
                    return true;
                } catch (error) {
                    console.error('Error al consultar deuda:', error);
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        'Lo siento, ocurrió un error al consultar tu deuda. Por favor, intenta nuevamente más tarde.');
                    return true;
                }
            }

            else if (selection.includes('ticket') || selection.includes('problema') || selection === 'crear_ticket' || 
                selection.includes('rear ticket') || selection.includes('reportar problema') || 
                selection.includes('reportar falla') || selection.includes('problema técnico') || 
                selection.includes('reportar problemas técnicos')) {
                // Activar flag para tickets
                session.creatingTicket = true;
                console.log('🎫 Activando flujo de creación de tickets desde TechnicalSupportFlow');
                return false; // Permitir que TicketCreationFlow maneje esto
            } else if (selection.includes('ping') || selection.includes('conexión') || selection === 'ping_ip') {
                // Activar flujo de diagnóstico IP sin mensaje adicional
                session.flowActive = 'ipDiagnostic';
                session.diagnosticInProgress = true;

                // Mensaje inicial del diagnóstico
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '📡 **Diagnóstico de Conexión**\n\n' +
                    'Iniciando verificación de tu conexión...\n\n' + '⏳ Por favor espera mientras verifico tu IP...');

                return false; // Permitir que IPDiagnosticFlow maneje esto
            }

            else if (selection.includes('password') || selection.includes('contraseña') || selection === 'cambiar_password') {
                // Activar cambio de contraseña
                session.changingPassword = true;
                return false; // Permitir que PasswordChangeFlow maneje esto
            } else if (selection.includes('comprobante') || selection === 'comprobante_pago') {
                // Enviar mensaje de soporte para comprobantes
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '📄 **Verificación de Comprobantes de Pago**\n\n' +
                    'Para verificar tu comprobante de pago, por favor envía una foto clara del recibo o captura de pantalla de la transferencia.\n\n' +
                    'Un asesor verificará tu pago y te notificará cuando sea registrado en el sistema.');

                return true;
            }

            else if (selection.includes('plan') || selection.includes('mejorar') || selection === 'mejorar_plan') {
                // Activar mejora de plan
                session.upgradingPlan = true;
                return false; // Permitir que PlanUpgradeFlow maneje esto
            }

            else if (selection.includes('puntos') || selection.includes('pago') || selection === 'puntos_pago') {
                // Mostrar información de puntos de pago actualizada
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '🏦 **Puntos de Pago Conecta2**\n\n' +
                    'Puedes realizar tu pago en cualquiera de estos puntos:\n\n' +
                    '📍 **Oficina Principal**\n' +
                    'Dirección: Centro de Piendamó, Cauca\n' +
                    'Horario: Lunes a Viernes 8:00 AM - 5:00 PM\n' +
                    'Sábados: 8:00 AM - 12:00 PM\n\n' +
                    '💳 **Transferencias Bancarias:**\n' +
                    'Banco: Bancolombia\n' +
                    'Cuenta: 123-456-789\n' +
                    'A nombre de: Conecta2 Telecomunicaciones\n\n' +
                    '🌐 **Pago Online:**\n' +
                    'Link: https://clientes.portalinternet.app/saldo/conecta2tel/\n\n' +
                    '💡 **Recuerda:** Envía tu comprobante de pago después de realizar la transacción.');

                return true; // Finalizamos aquí
            }

            else {
                // Opción no reconocida - No mostrar menú nuevamente, solo informar
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❓ No entendí tu selección. Por favor, usa el menú interactivo para seleccionar una opción válida.');
                return true;
            }

        } catch (error) {
            console.error('Error procesando selección del menú:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Hubo un error procesando tu selección. Por favor, intenta nuevamente.');
            return true;
        }
    }
}

import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';

/**
 * Flujo de soporte técnico mejorado con menú principal
 */
export class TechnicalSupportFlow extends BaseConversationFlow {
    readonly name: string = 'technicalSupport';

    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        return (
            message.toLowerCase() === 'soporte' ||
            session.selectedService === 'soporte' ||
            (user.authenticated && session.flowActive === 'technicalSupport')
        );
    }

    /**
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

            // Si está autenticado, mostrar el menú de soporte técnico
            session.flowActive = 'technicalSupport';
            await this.showTechnicalSupportMenu(user);
            return true;

        } catch (error) {
            console.error('Error en flujo de soporte técnico:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Lo siento, ha ocurrido un error. Por favor, intenta nuevamente.');
            return true;
        }
    }

    /**
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
                                    title: '📄 Facturas y Deudas',
                                    description: 'Consultar facturas y estado de cuenta'
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
                                    title: '📡 Verificar Conexión',
                                    description: 'Realizar ping a tu IP'
                                },
                                {
                                    id: 'soporte_ia',
                                    title: '🤖 Asistente IA',
                                    description: 'Soporte general con IA'
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
                                    id: 'comprobante_pago',
                                    title: '💳 Enviar Comprobante',
                                    description: 'Subir comprobante de pago'
                                },
                                {
                                    id: 'mejorar_plan',
                                    title: '⬆️ Mejorar Plan',
                                    description: 'Cambiar o mejorar tu plan actual'
                                }
                            ]
                        },
                        {
                            title: 'Otros Servicios',
                            rows: [
                                {
                                    id: 'puntos_pago',
                                    title: '🏦 Puntos de Pago',
                                    description: 'Ubicaciones y cuentas bancarias'
                                },
                                {
                                    id: 'asesor_humano',
                                    title: '👨‍💼 Hablar con Asesor',
                                    description: 'Transferir a asesor humano'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(supportMenu);
    }
}

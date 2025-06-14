import axios from 'axios';
import { config } from '../config';

export class MessageService {
    private static instance: MessageService;

    private constructor() { }

    public static getInstance(): MessageService {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    } async sendMessage(message: Record<string, unknown>): Promise<{ messageId?: string; success: boolean }> {
        try {
            console.log(`[MessageService] 📤 Enviando mensaje a WhatsApp API:`, JSON.stringify(message, null, 2));

            const response = await axios.post(
                `https://graph.facebook.com/${config.meta.version}/${config.meta.phoneNumberId}/messages`,
                message,
                {
                    headers: {
                        'Authorization': `Bearer ${config.meta.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`[MessageService] ✅ Mensaje enviado exitosamente:`, response.status, response.data);

            return {
                success: true,
                messageId: response.data?.messages?.[0]?.id || undefined
            };
        } catch (error: any) {
            console.error(`[MessageService] ❌ Error sending message:`, error.response?.data || error.message);
            return {
                success: false,
                messageId: undefined
            };
        }
    } async sendTextMessage(phoneNumber: string, text: string): Promise<{ messageId?: string; success: boolean }> {
        const message = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: text }
        };

        return await this.sendMessage(message);
    }

    async sendDocument(phoneNumber: string, documentUrl: string, filename: string): Promise<void> {
        const message = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'document',
            document: {
                link: documentUrl,
                filename: filename
            }
        };

        await this.sendMessage(message);
    }

    async sendLocation(phoneNumber: string, latitude: number, longitude: number, name: string, address: string): Promise<void> {
        const message = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'location',
            location: {
                latitude: latitude,
                longitude: longitude,
                name: name,
                address: address
            }
        };

        await this.sendMessage(message);
    }

    async sendPrivacyPolicyMessage(phoneNumber: string): Promise<void> {
        const privacyMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '🛡️ Conecta2 Telecomunicaciones'
                },
                body: {
                    text: 'Bienvenido a Conecta2 Telecomunicaciones SAS.\n\n' +
                        'Para brindarte el mejor servicio, necesitamos tu autorización para el ' +
                        'tratamiento de tus datos personales según nuestra política de privacidad.\n\n' +
                        '📋 Tus datos serán utilizados únicamente para:\n' +
                        '• Gestión de tu cuenta y servicios\n' +
                        '• Soporte técnico personalizado\n' +
                        '• Facturación y pagos\n' +
                        '• Comunicaciones importantes\n\n' +
                        '📄 *Marco Legal:*\n' +
                        '• Ley 1581 de 2012 - Protección de Datos Personales\n' +
                        '• Decreto 1377 de 2013\n\n' +
                        '🔗 *Política de Privacidad:*\n' +
                        'https://conecta2telecomunicaciones.com/legal/politica-de-privacidad\n\n' +
                        '¿Autorizas el tratamiento de tus datos personales?'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'accept_privacy',
                                title: 'Acepto'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'reject_privacy',
                                title: 'No acepto'
                            }
                        }
                    ]
                }
            }
        };

        await this.sendMessage(privacyMessage);
    }

    async sendMainMenu(phoneNumber: string): Promise<void> {
        const menuMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🌐 Conecta2 - Menú Principal'
                },
                body: {
                    text: 'Selecciona la opción que necesitas:'
                },
                action: {
                    button: 'Ver opciones',
                    sections: [
                        {
                            title: 'Servicios Técnicos',
                            rows: [
                                {
                                    id: 'ping',
                                    title: '📡 Test de Conexión',
                                    description: 'Verificar estado de tu conexión'
                                }, {
                                    id: 'ticket',
                                    title: '🔧 Soporte Técnico',
                                    description: 'Reportar problemas técnicos'
                                }
                            ]
                        },
                        {
                            title: 'Facturación',
                            rows: [
                                {
                                    id: 'factura',
                                    title: '📄 Mi Factura',
                                    description: 'Consultar y descargar facturas'
                                },
                                {
                                    id: 'deuda',
                                    title: '💰 Consultar Deuda',
                                    description: 'Ver saldo pendiente'
                                },
                                {
                                    id: 'puntos_pago',
                                    title: '📍 Puntos de Pago',
                                    description: 'Ubicaciones para pagar'
                                }
                            ]
                        }, {
                            title: 'Cuenta',
                            rows: [
                                {
                                    id: 'cambiar_clave',
                                    title: '🔐 Cambiar Contraseña',
                                    description: 'Actualizar clave de acceso'
                                },
                                {
                                    id: 'mejorar_plan',
                                    title: '⬆️ Mejorar Plan',
                                    description: 'Upgrade de velocidad'
                                }, {
                                    id: 'validar_pago',
                                    title: '💳 Validar Pago',
                                    description: 'Subir comprobante de pago'
                                }
                            ]
                        }, {
                            title: 'General',
                            rows: [
                                {
                                    id: 'hablar_agente',
                                    title: '👨‍💼 Hablar con Agente',
                                    description: 'Contactar soporte humano'
                                },
                                {
                                    id: 'cerrar_sesion',
                                    title: '👋 Cerrar Sesión',
                                    description: 'Finalizar sesión actual'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.sendMessage(menuMessage);
    }

    async sendPaymentOptions(phoneNumber: string): Promise<void> {
        const paymentMessage = {
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
                    text: 'Puedes pagar tu factura de las siguientes maneras:'
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
                                id: 'pago_online',
                                title: '💻 Pago Online'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'banco',
                                title: '🏦 Bancos'
                            }
                        }
                    ]
                }
            }
        };

        await this.sendMessage(paymentMessage);
    }

    async sendLimitedOptionsMenu(phoneNumber: string): Promise<void> {
        const limitedMenuMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🔶 Opciones Disponibles'
                },
                body: {
                    text: 'Tu servicio está inactivo. Estas son las opciones disponibles:'
                },
                action: {
                    button: 'Ver opciones',
                    sections: [
                        {
                            title: 'Facturación',
                            rows: [
                                {
                                    id: 'factura',
                                    title: '📄 Mi Factura',
                                    description: 'Consultar y descargar facturas'
                                },
                                {
                                    id: 'deuda',
                                    title: '💰 Consultar Deuda',
                                    description: 'Ver saldo pendiente'
                                },
                                {
                                    id: 'puntos_pago',
                                    title: '📍 Puntos de Pago',
                                    description: 'Ubicaciones para pagar'
                                }
                            ]
                        },
                        {
                            title: 'Soporte',
                            rows: [
                                {
                                    id: 'reactivar',
                                    title: '🔄 Reactivar Servicio',
                                    description: 'Opciones para reactivación'
                                },
                                {
                                    id: 'hablar_agente',
                                    title: '👨‍💼 Hablar con Agente',
                                    description: 'Contactar soporte humano'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.sendMessage(limitedMenuMessage);
    }

    async sendSuspendedServiceMenu(phoneNumber: string): Promise<void> {
        const suspendedMenuMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '⚠️ Servicio Suspendido'
                },
                body: {
                    text: 'Tu servicio está actualmente suspendido. Para resolverlo necesitas contactar a nuestro equipo:'
                },
                action: {
                    button: 'Ver opciones',
                    sections: [
                        {
                            title: 'Atención Personalizada',
                            rows: [
                                {
                                    id: 'hablar_agente',
                                    title: '👨‍💼 Contactar Soporte',
                                    description: 'Hablar con un agente para reactivar servicio'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.sendMessage(suspendedMenuMessage);
    }

    async sendErrorMessage(phoneNumber: string, text: string): Promise<void> {
        await this.sendTextMessage(phoneNumber, `❌ ${text}`);
    }

    /**
     * Envía botones de acción al usuario (como Volver al Menú o Finalizar)
     */
    async sendActionButtons(phoneNumber: string, headerText: string, bodyText: string, buttons: { id: string, title: string }[]): Promise<void> {
        const actionMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: headerText
                },
                body: {
                    text: bodyText
                },
                action: {
                    buttons: buttons.map(button => ({
                        type: 'reply',
                        reply: {
                            id: button.id,
                            title: button.title
                        }
                    }))
                }
            }
        };

        await this.sendMessage(actionMessage);
    }

    /**
     * Envía botones de navegación estándar (Menú Principal y Finalizar)
     */
    async sendNavigationButtons(phoneNumber: string, headerText: string, bodyText: string): Promise<void> {
        await this.sendActionButtons(
            phoneNumber,
            headerText,
            bodyText,
            [
                { id: 'menu', title: '🏠 Menú Principal' },
                { id: 'finalizar', title: '✅ Finalizar' }
            ]
        );
    }

    /**
     * Envía un menú simplificado con botones para mejor usabilidad en zona rural
     */
    async sendSimplifiedMenu(phoneNumber: string): Promise<void> {
        const menuMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '🌐 Conecta2 - Menú Principal'
                },
                body: {
                    text: 'Selecciona qué necesitas hacer:\n\n' +
                        '• Consultar tu factura o deuda\n' +
                        '• Reportar un problema técnico\n' +
                        '• Hablar con un agente humano\n\n' +
                        'Escoge una opción:'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'factura_deuda',
                                title: '💰 Factura/Deuda'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'soporte_tecnico',
                                title: '🔧 Problema Técnico'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'hablar_agente',
                                title: '👨‍💼 Hablar con Agente'
                            }
                        }
                    ]
                }
            }
        };

        await this.sendMessage(menuMessage);
    }
}
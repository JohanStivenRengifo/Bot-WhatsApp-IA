// flows/authFlow.js
const wisphubService = require('../services/wisphubService');
const logger = require('../utils/logger');

class AuthFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    async handleFlow(conversation, message) {
        const step = conversation.currentStep || 'inicio';

        switch (step) {
            case 'inicio':
                return this.handleInicio(conversation);
            case 'solicitar_consentimiento':
                return this.handleConsentimiento(conversation, message);
            case 'cedula':
                return this.handleCedula(conversation, message);
            case 'menu_autenticado':
                return this.handleMenuAutenticado(conversation, message);
            default:
                return this.handleInicio(conversation);
        }
    }

    async handleInicio(conversation) {
        // Si es un usuario que regresa y ya estaba autenticado, mostrar mensaje de bienvenida personalizado
        if (conversation.userData && conversation.userData.authenticated && conversation.userData.nombreCompleto) {
            const lastActivity = conversation.lastActivity;
            const now = new Date();
            const hoursSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60));
            
            // Verificar si la sesión ha expirado (más de 24 horas)
            if (hoursSinceLastActivity > 24) {
                // La sesión ha expirado, solicitar nueva autenticación
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    `Hola ${conversation.userData.nombreCompleto}, por seguridad tu sesión ha expirado. Necesitamos verificar tu identidad nuevamente.`
                );
                // Resetear autenticación pero mantener el nombre para personalización
                const nombreGuardado = conversation.userData.nombreCompleto;
                conversation.userData = {
                    authenticated: false,
                    nombreCompleto: nombreGuardado
                };
            } else {
                // Sesión válida, mostrar mensaje de bienvenida personalizado
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    `¡Hola de nuevo, ${conversation.userData.nombreCompleto}! 👋 Bienvenido nuevamente a Conecta2.`
                );
                
                // Verificar si hay facturas próximas a vencer (menos de 5 días)
                if (conversation.userData.facturasPendientes && conversation.userData.facturasPendientes.length > 0) {
                    const facturasProximasVencer = conversation.userData.facturasPendientes.filter(factura => {
                        const fechaVencimiento = new Date(factura.due_date);
                        const diasParaVencer = Math.floor((fechaVencimiento - now) / (1000 * 60 * 60 * 24));
                        return diasParaVencer >= 0 && diasParaVencer <= 5;
                    });
                    
                    if (facturasProximasVencer.length > 0) {
                        await this.whatsappService.sendTextMessage(
                            conversation.phoneNumber,
                            `📢 *Recordatorio importante*: Tienes ${facturasProximasVencer.length} factura(s) próxima(s) a vencer en los próximos 5 días.`
                        );
                    }
                }
                
                // Mostrar menú autenticado directamente
                conversation.currentStep = 'menu_autenticado';
                const buttons = [
                    {
                        type: 'reply',
                        reply: {
                            id: 'ver_facturas',
                            title: '📋 Ver Facturas'
                        }
                    },
                    {
                        type: 'reply',
                        reply: {
                            id: 'registrar_pago',
                            title: '💳 Registrar Pago'
                        }
                    },
                    {
                        type: 'reply',
                        reply: {
                            id: 'soporte_tecnico',
                            title: '🛠️ Soporte Técnico'
                        }
                    }
                ];
                
                await this.whatsappService.sendInteractiveMessage(
                    conversation.phoneNumber,
                    'Menú Principal',
                    '¿Qué acción deseas realizar?',
                    buttons
                );
                return null;
            }
        }
        
        // Mensaje explicativo sobre el propósito de la autenticación
        await this.whatsappService.sendTextMessage(
            conversation.phoneNumber,
            "🔐 *Autenticación de Usuario*\n\n" +
            "Para brindarte un servicio personalizado y acceso a tus facturas, servicios y soporte técnico, necesitamos verificar tu identidad.\n\n" +
            "Tus datos serán tratados con confidencialidad y solo se utilizarán para mejorar tu experiencia con nuestro servicio."
        );
        
        // Solicitar consentimiento explícito
        conversation.currentStep = 'solicitar_consentimiento';
        
        const buttons = [
            {
                type: 'reply',
                reply: {
                    id: 'auth_consent_yes',
                    title: '✅ Acepto continuar'
                }
            },
            {
                type: 'reply',
                reply: {
                    id: 'auth_consent_no',
                    title: '❌ No acepto'
                }
            }
        ];
        
        await this.whatsappService.sendInteractiveMessage(
            conversation.phoneNumber,
            'Consentimiento',
            '¿Nos autorizas a verificar tu identidad con tu número de cédula?',
            buttons
        );
        return null;
    }
    
    async handleConsentimiento(conversation, message) {
        if (!message || !message.type === 'interactive' || !message.interactive?.button_reply?.id) {
            // Si no es un mensaje interactivo válido, volver a solicitar consentimiento
            return this.handleInicio(conversation);
        }
        
        const option = message.interactive.button_reply.id;
        
        if (option === 'auth_consent_yes') {
            // Usuario dio consentimiento, solicitar cédula
            conversation.currentStep = 'cedula';
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Por favor, ingresa tu número de cédula para acceder a tus servicios personalizados:"
            );
            return null;
        } else {
            // Usuario no dio consentimiento
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Entendemos tu decisión. Puedes seguir utilizando nuestro servicio de forma limitada sin autenticación."
            );
            
            // Redirigir al flujo principal
            conversation.currentFlow = 'main';
            conversation.currentStep = 'welcome';
            return { flow: 'main' };
        }
    }

    async handleCedula(conversation, message) {
        try {
            const cedula = message.trim();

            // Validar formato de cédula
            if (!/^\d{8,12}$/.test(cedula)) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "⚠️ Por favor, ingresa un número de cédula válido (entre 8 y 12 dígitos)."
                );
                return this.handleInicio(conversation);
            }

            // Consultar usuario en Wisphub
            const userData = await wisphubService.getUserByCedula(cedula);

            if (!userData) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "⚠️ No encontramos un cliente registrado con esa cédula. Por favor, verifica el número o continúa sin autenticación."
                );

                const buttons = [
                    {
                        type: 'reply',
                        reply: {
                            id: 'retry_auth',
                            title: '🔄 Intentar de nuevo'
                        }
                    },
                    {
                        type: 'reply',
                        reply: {
                            id: 'skip_auth',
                            title: '➡️ Continuar sin autenticación'
                        }
                    }
                ];

                await this.whatsappService.sendInteractiveMessage(
                    conversation.phoneNumber,
                    'Opciones',
                    '¿Qué deseas hacer?',
                    buttons
                );
                return null;
            }

            // Obtener servicios y facturas pendientes
            const [servicios, facturas] = await Promise.all([
                wisphubService.getServiciosCliente(userData.id),
                wisphubService.getFacturasCliente(userData.id, { status: 'unpaid' })
            ]);

            // Guardar datos del usuario en la conversación
            conversation.userData = {
                ...conversation.userData,
                id: userData.id,
                cedula,
                nombreCompleto: userData.nombreCompleto,
                email: userData.email,
                direccion: userData.direccion,
                telefono: userData.telefono,
                estado: userData.estado,
                servicios: servicios,
                facturasPendientes: facturas,
                authenticated: true
            };

            // Mensaje de bienvenida personalizado con resumen
            let welcomeMessage = `¡Bienvenido(a) ${userData.nombreCompleto}! 👋\n\n`;
            welcomeMessage += `📱 Teléfono: ${userData.telefono}\n`;
            welcomeMessage += `📧 Email: ${userData.email}\n\n`;

            if (servicios.length > 0) {
                welcomeMessage += `📡 Servicios activos:\n`;
                servicios.forEach(servicio => {
                    welcomeMessage += `• ${servicio.name} - ${servicio.status}\n`;
                });
                welcomeMessage += '\n';
            }

            // Personalización basada en facturas pendientes
            if (facturas.length > 0) {
                welcomeMessage += `📋 Tienes ${facturas.length} factura(s) pendiente(s) de pago.\n`;
                
                // Verificar si hay facturas próximas a vencer (menos de 5 días)
                const now = new Date();
                const facturasProximasVencer = facturas.filter(factura => {
                    const fechaVencimiento = new Date(factura.due_date);
                    const diasParaVencer = Math.floor((fechaVencimiento - now) / (1000 * 60 * 60 * 24));
                    return diasParaVencer >= 0 && diasParaVencer <= 5;
                });
                
                if (facturasProximasVencer.length > 0) {
                    welcomeMessage += `\n⚠️ *Importante*: Tienes ${facturasProximasVencer.length} factura(s) que vence(n) en los próximos 5 días.\n`;
                }
            } else {
                welcomeMessage += `\n✅ ¡Felicitaciones! No tienes facturas pendientes de pago.\n`;
            }

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                welcomeMessage
            );

            // Mostrar menú de opciones adaptado al perfil del cliente
            conversation.currentStep = 'menu_autenticado';
            let buttons = [
                {
                    type: 'reply',
                    reply: {
                        id: 'ver_facturas',
                        title: '📋 Ver Facturas'
                    }
                },
                {
                    type: 'reply',
                    reply: {
                        id: 'soporte_tecnico',
                        title: '🛠️ Soporte Técnico'
                    }
                },
                {
                    type: 'reply',
                    reply: {
                        id: 'cerrar_sesion',
                        title: '🔒 Cerrar Sesión'
                    }
                }
            ];
            
            // Adaptar opciones según el perfil del cliente
            if (facturas.length > 0) {
                // Si tiene facturas pendientes, priorizar la opción de pago
                buttons.unshift({
                    type: 'reply',
                    reply: {
                        id: 'registrar_pago',
                        title: '💳 Registrar Pago'
                    }
                });
            }

            await this.whatsappService.sendInteractiveMessage(
                conversation.phoneNumber,
                'Menú Principal',
                '¿Qué acción deseas realizar?',
                buttons
            );
            return null;

        } catch (error) {
            logger.error('Error en autenticación:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "Lo siento, hubo un error al verificar tu identidad. Por favor, intenta nuevamente más tarde."
            );
            return this.handleInicio(conversation);
        }
    }

    async handleMenuAutenticado(conversation, message) {
        if (!message || !message.type === 'interactive' || !message.interactive?.button_reply?.id) {
            return null;
        }

        const option = message.interactive.button_reply.id;

        switch (option) {
            case 'ver_facturas':
                conversation.currentFlow = 'facturas';
                conversation.currentStep = 'inicio';
                return { flow: 'facturas' };

            case 'registrar_pago':
                conversation.currentFlow = 'pagos';
                conversation.currentStep = 'inicio';
                return { flow: 'pagos' };

            case 'soporte_tecnico':
                conversation.currentFlow = 'soporte';
                conversation.currentStep = 'inicio';
                return { flow: 'soporte' };
                
            case 'cerrar_sesion':
                // Cerrar sesión del usuario
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    `Gracias por usar nuestros servicios, ${conversation.userData.nombreCompleto}. Tu sesión ha sido cerrada por seguridad.`
                );
                
                // Guardar el nombre para personalización futura
                const nombreGuardado = conversation.userData.nombreCompleto;
                
                // Resetear datos de autenticación pero mantener el nombre
                conversation.userData = {
                    authenticated: false,
                    nombreCompleto: nombreGuardado
                };
                
                // Redirigir al flujo principal
                conversation.currentFlow = 'main';
                conversation.currentStep = 'welcome';
                return { flow: 'main' };

            default:
                // Mostrar menú principal
                const buttons = [
                    {
                        type: 'reply',
                        reply: {
                            id: 'ver_facturas',
                            title: '📋 Ver Facturas'
                        }
                    },
                    {
                        type: 'reply',
                        reply: {
                            id: 'registrar_pago',
                            title: '💳 Registrar Pago'
                        }
                    },
                    {
                        type: 'reply',
                        reply: {
                            id: 'soporte_tecnico',
                            title: '🛠️ Soporte Técnico'
                        }
                    },
                    {
                        type: 'reply',
                        reply: {
                            id: 'cerrar_sesion',
                            title: '🔒 Cerrar Sesión'
                        }
                    }
                ];

                // Personalizar el mensaje con el nombre del cliente
                const nombreCliente = conversation.userData.nombreCompleto || '';
                const mensajeSaludo = nombreCliente ? `Hola ${nombreCliente}, ` : '';
                
                await this.whatsappService.sendInteractiveMessage(
                    conversation.phoneNumber,
                    'Menú Principal',
                    `${mensajeSaludo}¿Qué acción deseas realizar?`,
                    buttons
                );
                return null;
        }
    }
}

module.exports = AuthFlow;

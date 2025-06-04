import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';

/**
 * Flujo para actualización/upgrade de planes con análisis de plan actual
 */
export class PlanUpgradeFlow extends BaseConversationFlow {
    readonly name: string = 'planUpgrade';

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
            user.authenticated &&
            (message === 'mejorar_plan' ||
                message === 'upgrade_plan' ||
                message === 'cambiar_plan' ||
                message === 'planes_disponibles' ||
                session.upgradingPlan === true)
        );
    }

    /**
     * Maneja el proceso de upgrade de planes
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            if (!session.upgradingPlan) {
                return await this.initializePlanUpgrade(user, session);
            }

            // Procesar según el paso actual
            switch (session.step) {
                case 'service_selection':
                    return await this.handleServiceSelection(user, message, session);
                case 'confirmation':
                    return await this.handleUpgradeConfirmation(user, message, session);
                default:
                    return await this.initializePlanUpgrade(user, session);
            }

        } catch (error) {
            console.error('Error en flujo de upgrade de plan:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error procesando la solicitud de upgrade. Contacta a nuestro equipo comercial.');

            this.resetUpgradeSession(session);
            return true;
        }
    }

    /**
     * Inicializa el proceso de upgrade de plan
     */
    private async initializePlanUpgrade(user: User, session: SessionData): Promise<boolean> {
        session.upgradingPlan = true;

        // Verificar servicios del usuario
        const userServices = await this.getUserServices(user);

        if (userServices.length === 0) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ No encontré servicios activos en tu cuenta.\n\n' +
                'Por favor, contacta a nuestro equipo comercial para más información.');

            this.resetUpgradeSession(session);
            return true;
        }

        if (userServices.length === 1) {
            // Usuario con un solo servicio
            return await this.showUpgradeOptions(user, userServices[0], session);
        } else {
            // Usuario con múltiples servicios
            return await this.showServiceSelection(user, userServices, session);
        }
    }

    /**
     * Muestra selección de servicios para usuarios multi-servicio
     */
    private async showServiceSelection(user: User, services: any[], session: SessionData): Promise<boolean> {
        session.step = 'service_selection';
        session.availableServices = services;

        const servicesList = services.map((service, index) => ({
            id: service.id,
            title: `📍 ${service.location}`,
            description: `${service.plan} - ${service.status}`
        }));

        const selectionMessage = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🏠 Seleccionar Servicio'
                },
                body: {
                    text: 'Tienes múltiples servicios. ¿Para cuál deseas consultar opciones de upgrade?'
                },
                action: {
                    button: 'Seleccionar',
                    sections: [
                        {
                            title: 'Tus Servicios',
                            rows: servicesList
                        }
                    ]
                }
            }
        };

        await this.messageService.sendMessage(selectionMessage);
        return true;
    }

    /**
     * Maneja la selección de servicio
     */
    private async handleServiceSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        const selectedService = session.availableServices?.find(service => service.id === message);

        if (!selectedService) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Servicio no válido. Por favor, selecciona una opción del menú.');
            return true;
        }

        session.selectedServiceId = message;
        return await this.showUpgradeOptions(user, selectedService, session);
    }

    /**
     * Muestra las opciones de upgrade disponibles
     */
    private async showUpgradeOptions(user: User, currentService: any, session: SessionData): Promise<boolean> {
        const availableUpgrades = await this.getAvailableUpgrades(currentService);

        if (availableUpgrades.length === 0) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🎯 **Ya tienes nuestro mejor plan disponible**\n\n' +
                `📊 Plan actual: ${currentService.plan}\n` +
                `🚀 Velocidad: ${currentService.speed}\n` +
                `💰 Valor: $${currentService.price?.toLocaleString()}\n\n` +
                '🎉 ¡Gracias por confiar en nuestro servicio premium!\n\n' +
                '💡 Si necesitas mayor velocidad, consulta por nuestros planes empresariales escribiendo "planes_empresariales".');

            this.resetUpgradeSession(session);
            return true;
        }

        // Analizar patrón de uso para recomendaciones personalizadas
        const usageAnalysis = await this.analyzeUsagePattern(user.customerId!);
        const recommendation = this.getPersonalizedRecommendation(availableUpgrades, usageAnalysis);

        let upgradeMessage = `⬆️ **Opciones de Upgrade Disponibles**\n\n` +
            `📊 **Plan actual:** ${currentService.plan}\n` +
            `🚀 **Velocidad actual:** ${currentService.speed}\n` +
            `💰 **Precio actual:** $${currentService.price?.toLocaleString()}\n\n`;

        if (recommendation) {
            upgradeMessage += `💡 **Recomendación personalizada:** ${recommendation.reason}\n\n`;
        }

        upgradeMessage += `**Planes disponibles:**\n\n`;

        const upgradeButtons = availableUpgrades.slice(0, 3).map((plan, index) => {
            const discount = this.calculateUpgradeDiscount(currentService.price, plan.price);
            const isRecommended = recommendation && recommendation.planId === plan.id;

            upgradeMessage += `${isRecommended ? '⭐' : `${index + 1}.`} **${plan.name}**\n` +
                `   🚀 Velocidad: ${plan.speed}\n` +
                `   💰 Precio: $${plan.price.toLocaleString()}` +
                (discount > 0 ? ` (${discount}% descuento primer mes)` : '') + '\n' +
                `   📝 ${plan.description}\n\n`;

            return {
                type: 'reply',
                reply: {
                    id: `upgrade_${plan.id}`,
                    title: `${isRecommended ? '⭐' : '📈'} ${plan.name}`
                }
            };
        });

        upgradeMessage += '🎁 **Beneficios del upgrade:**\n' +
            '• Instalación gratuita\n' +
            '• Mantienes tu número IP\n' +
            '• Sin permanencia adicional\n' +
            '• Soporte técnico prioritario\n\n' +
            'Selecciona el plan que más te convenga:';

        // Enviar mensaje con información
        await this.messageService.sendTextMessage(user.phoneNumber, upgradeMessage);

        // Enviar botones de selección
        const buttonMessage = {
            messaging_product: 'whatsapp',
            to: user.phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '📈 Seleccionar Plan'
                },
                body: {
                    text: '¿Cuál plan te interesa?'
                },
                action: {
                    buttons: upgradeButtons
                }
            }
        };

        await this.messageService.sendMessage(buttonMessage);

        session.step = 'confirmation';
        return true;
    }

    /**
     * Maneja la confirmación de upgrade
     */
    private async handleUpgradeConfirmation(user: User, message: string, session: SessionData): Promise<boolean> {
        if (!message.startsWith('upgrade_')) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❓ Por favor, selecciona una de las opciones de upgrade del menú.');
            return true;
        }

        const planId = message.replace('upgrade_', '');
        const selectedPlan = await this.getPlanDetails(planId);

        if (!selectedPlan) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Plan no encontrado. Por favor, intenta nuevamente.');
            return true;
        }

        // Procesar la solicitud de upgrade
        try {
            const upgradeResult = await this.processUpgradeRequest(user, selectedPlan, session);

            if (upgradeResult.success) {
                await this.sendUpgradeConfirmation(user, selectedPlan, upgradeResult);
            } else {
                await this.sendUpgradeError(user, upgradeResult.error);
            }

            this.resetUpgradeSession(session);
            return true;

        } catch (error) {
            console.error('Error procesando upgrade:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Error procesando el upgrade. Por favor, contacta a nuestro equipo comercial.');

            this.resetUpgradeSession(session);
            return true;
        }
    }

    /**
     * Obtiene los servicios del usuario
     */
    private async getUserServices(user: User): Promise<any[]> {
        try {
            // En implementación real, esto consultaría WispHub API
            return [
                {
                    id: 'service_1',
                    location: 'Dirección Principal',
                    plan: 'Plan Hogar 30MB',
                    speed: '30/10 Mbps',
                    price: 78900,
                    status: 'Activo'
                }
            ];
        } catch (error) {
            console.error('Error obteniendo servicios:', error);
            return [];
        }
    }

    /**
     * Obtiene los upgrades disponibles para un servicio
     */
    private async getAvailableUpgrades(currentService: any): Promise<any[]> {
        const allPlans = [
            {
                id: 'plan_50',
                name: 'Plan Hogar 50MB',
                speed: '50/20 Mbps',
                price: 98900,
                description: 'Ideal para familias que usan streaming y gaming'
            },
            {
                id: 'plan_100',
                name: 'Plan Hogar 100MB',
                speed: '100/50 Mbps',
                price: 138900,
                description: 'Máximo rendimiento para trabajo remoto y entretenimiento'
            },
            {
                id: 'plan_200',
                name: 'Plan Ultra 200MB',
                speed: '200/100 Mbps',
                price: 198900,
                description: 'Para usuarios avanzados y múltiples dispositivos'
            }
        ];

        // Filtrar planes superiores al actual
        return allPlans.filter(plan => plan.price > currentService.price);
    }

    /**
     * Analiza patrón de uso del cliente
     */
    private async analyzeUsagePattern(customerId: string): Promise<any> {
        // Simular análisis de uso
        return {
            averageUsage: 80, // Porcentaje de uso promedio
            peakHours: ['19:00-23:00'],
            devices: 8,
            streamingUsage: 'high',
            gamingUsage: 'medium'
        };
    }

    /**
     * Obtiene recomendación personalizada basada en uso
     */
    private getPersonalizedRecommendation(plans: any[], usage: any): any {
        if (usage.averageUsage > 70 && usage.streamingUsage === 'high') {
            return {
                planId: 'plan_100',
                reason: 'Basado en tu alto uso de streaming, recomendamos 100MB para mejor experiencia'
            };
        }

        if (usage.devices > 5) {
            return {
                planId: 'plan_50',
                reason: 'Con múltiples dispositivos conectados, 50MB mejorará tu velocidad'
            };
        }

        return null;
    }

    /**
     * Calcula descuento por upgrade
     */
    private calculateUpgradeDiscount(currentPrice: number, newPrice: number): number {
        const difference = newPrice - currentPrice;
        if (difference > 50000) return 20; // 20% descuento para upgrades grandes
        if (difference > 30000) return 15; // 15% descuento para upgrades medianos
        if (difference > 20000) return 10; // 10% descuento para upgrades pequeños
        return 0;
    }

    /**
     * Obtiene detalles de un plan específico
     */
    private async getPlanDetails(planId: string): Promise<any> {
        const plans: any = {
            'plan_50': {
                id: 'plan_50',
                name: 'Plan Hogar 50MB',
                speed: '50/20 Mbps',
                price: 98900,
                description: 'Ideal para familias que usan streaming y gaming'
            },
            'plan_100': {
                id: 'plan_100',
                name: 'Plan Hogar 100MB',
                speed: '100/50 Mbps',
                price: 138900,
                description: 'Máximo rendimiento para trabajo remoto y entretenimiento'
            },
            'plan_200': {
                id: 'plan_200',
                name: 'Plan Ultra 200MB',
                speed: '200/100 Mbps',
                price: 198900,
                description: 'Para usuarios avanzados y múltiples dispositivos'
            }
        };

        return plans[planId] || null;
    }

    /**
     * Procesa la solicitud de upgrade
     */
    private async processUpgradeRequest(user: User, plan: any, session: SessionData): Promise<any> {
        try {
            // En implementación real, esto crearía la orden en WispHub
            const orderId = 'UPG' + Date.now();

            return {
                success: true,
                orderId,
                estimatedActivation: '24-48 horas',
                discount: this.calculateUpgradeDiscount(78900, plan.price)
            };
        } catch (error) {
            return {
                success: false,
                error: 'Error técnico al procesar la solicitud'
            };
        }
    }

    /**
     * Envía confirmación de upgrade exitoso
     */
    private async sendUpgradeConfirmation(user: User, plan: any, result: any): Promise<void> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            '🎉 **¡Upgrade Solicitado Exitosamente!**\n\n' +
            `📋 **Orden ID:** ${result.orderId}\n` +
            `📈 **Nuevo plan:** ${plan.name}\n` +
            `🚀 **Nueva velocidad:** ${plan.speed}\n` +
            `💰 **Nuevo precio:** $${plan.price.toLocaleString()}` +
            (result.discount > 0 ? `\n🎁 **Descuento primer mes:** ${result.discount}%` : '') + '\n\n' +
            '⏱️ **Tiempo de activación:** ' + result.estimatedActivation + '\n\n' +
            '📋 **Próximos pasos:**\n' +
            '• Tu solicitud está en proceso\n' +
            '• No necesitas hacer nada más\n' +
            '• Te notificaremos cuando esté activo\n' +
            '• El cambio será automático\n\n' +
            '📱 Te mantendremos informado del progreso.');

        // Enviar información adicional
        setTimeout(async () => {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '💡 **Información importante:**\n\n' +
                '• Tu servicio actual seguirá funcionando\n' +
                '• El upgrade se hará sin cortes\n' +
                '• La facturación se ajustará automáticamente\n' +
                '• Conservarás tu dirección IP actual\n\n' +
                '❓ Si tienes preguntas, escribe "estado_upgrade" para consultar el progreso.');
        }, 3000);
    }

    /**
     * Envía mensaje de error en upgrade
     */
    private async sendUpgradeError(user: User, error: string): Promise<void> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            `❌ **No se pudo procesar el upgrade**\n\n` +
            `**Motivo:** ${error}\n\n` +
            '🤝 **¿Qué puedes hacer?**\n' +
            '• Contactar a nuestro equipo comercial\n' +
            '• Intentar nuevamente más tarde\n' +
            '• Solicitar asesoría personalizada\n\n' +
            'Escribe "agente_comercial" para hablar con un asesor.');
    }

    /**
     * Resetea el estado de sesión de upgrade
     */
    private resetUpgradeSession(session: SessionData): void {
        session.upgradingPlan = false;
        session.step = undefined;
        session.selectedServiceId = undefined;
        session.availableServices = undefined;
    }
}

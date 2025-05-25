const logger = require('../utils/logger');
const userService = require('./userService');
const templateService = require('./templateService');

class FlowService {
    constructor() {
        this.flows = new Map();
        this.initializeFlows();
    }

    /**
     * Inicializa los flujos de conversación
     */
    initializeFlows() {
        // Flujo de bienvenida
        this.flows.set('welcome', {
            id: 'welcome',
            name: 'Bienvenida',
            steps: [
                {
                    id: 'greeting',
                    type: 'template',
                    template: 'welcome_message',
                    next: 'main_menu'
                },
                {
                    id: 'main_menu',
                    type: 'interactive',
                    content: {
                        type: 'list',
                        header: {
                            type: 'text',
                            text: 'Menú Principal'
                        },
                        body: {
                            text: '¿En qué puedo ayudarte hoy?'
                        },
                        action: {
                            button: 'Ver opciones',
                            sections: [
                                {
                                    title: 'Servicios',
                                    rows: [
                                        { id: 'service_1', title: 'Servicio 1' },
                                        { id: 'service_2', title: 'Servicio 2' }
                                    ]
                                },
                                {
                                    title: 'Soporte',
                                    rows: [
                                        { id: 'support', title: 'Contactar soporte' },
                                        { id: 'faq', title: 'Preguntas frecuentes' }
                                    ]
                                }
                            ]
                        }
                    }
                }
            ]
        });

        // Flujo de soporte
        this.flows.set('support', {
            id: 'support',
            name: 'Soporte',
            steps: [
                {
                    id: 'support_greeting',
                    type: 'text',
                    content: '¿Cómo podemos ayudarte? Por favor, describe tu problema.',
                    next: 'support_response'
                },
                {
                    id: 'support_response',
                    type: 'text',
                    content: 'Gracias por tu mensaje. Un agente te contactará pronto.',
                    next: 'support_confirmation'
                },
                {
                    id: 'support_confirmation',
                    type: 'interactive',
                    content: {
                        type: 'button',
                        body: {
                            text: '¿Necesitas algo más?'
                        },
                        action: {
                            buttons: [
                                { id: 'yes', title: 'Sí' },
                                { id: 'no', title: 'No' }
                            ]
                        }
                    }
                }
            ]
        });

        // Flujo de FAQ
        this.flows.set('faq', {
            id: 'faq',
            name: 'Preguntas Frecuentes',
            steps: [
                {
                    id: 'faq_menu',
                    type: 'interactive',
                    content: {
                        type: 'list',
                        header: {
                            type: 'text',
                            text: 'Preguntas Frecuentes'
                        },
                        body: {
                            text: 'Selecciona una pregunta para ver su respuesta:'
                        },
                        action: {
                            button: 'Ver preguntas',
                            sections: [
                                {
                                    title: 'Preguntas Generales',
                                    rows: [
                                        { id: 'faq_1', title: '¿Cómo funciona?' },
                                        { id: 'faq_2', title: '¿Cuáles son los horarios?' }
                                    ]
                                }
                            ]
                        }
                    }
                }
            ]
        });
    }

    /**
     * Obtiene el flujo actual de un usuario
     * @param {string} userId - ID del usuario
     * @returns {Promise<Object>} Flujo actual
     */
    async getCurrentFlow(userId) {
        try {
            const user = await userService.getUser(userId);
            const flowId = user.currentFlow || 'welcome';
            const flow = this.flows.get(flowId);

            if (!flow) {
                logger.error('❌ Flujo no encontrado', { flowId });
                throw new Error('Flujo no encontrado');
            }

            return flow;
        } catch (error) {
            logger.error('❌ Error obteniendo flujo actual:', error);
            throw error;
        }
    }

    /**
     * Procesa un mensaje según el flujo actual
     * @param {Object} flow - Flujo actual
     * @param {string} message - Mensaje recibido
     * @param {Object} user - Usuario que envió el mensaje
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async processMessage(flow, message, user) {
        try {
            const currentStep = await this.getCurrentStep(flow, user);

            if (!currentStep) {
                logger.warn('⚠️ No hay paso actual en el flujo', { flowId: flow.id });
                return null;
            }

            // Procesar el mensaje según el tipo de paso
            switch (currentStep.type) {
                case 'text':
                    return await this.processTextStep(currentStep, message, user);
                case 'template':
                    return await this.processTemplateStep(currentStep, user);
                case 'interactive':
                    return await this.processInteractiveStep(currentStep, message, user);
                default:
                    logger.warn('⚠️ Tipo de paso no manejado', { type: currentStep.type });
                    return null;
            }
        } catch (error) {
            logger.error('❌ Error procesando mensaje:', error);
            throw error;
        }
    }

    /**
     * Procesa una respuesta de botón
     * @param {Object} flow - Flujo actual
     * @param {string} buttonId - ID del botón
     * @param {string} buttonTitle - Título del botón
     * @param {Object} user - Usuario que envió el mensaje
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async processButtonResponse(flow, buttonId, buttonTitle, user) {
        try {
            const currentStep = await this.getCurrentStep(flow, user);

            if (!currentStep || currentStep.type !== 'interactive') {
                logger.warn('⚠️ Paso actual no es interactivo', { flowId: flow.id });
                return null;
            }

            // Determinar el siguiente paso según el botón presionado
            const nextStep = this.getNextStep(flow, buttonId);

            if (nextStep) {
                await this.updateUserStep(user._id, flow.id, nextStep.id);
                return this.createStepResponse(nextStep, user);
            }

            return null;
        } catch (error) {
            logger.error('❌ Error procesando respuesta de botón:', error);
            throw error;
        }
    }

    /**
     * Procesa una respuesta de lista
     * @param {Object} flow - Flujo actual
     * @param {string} listId - ID de la opción de lista
     * @param {string} listTitle - Título de la opción
     * @param {string} listDescription - Descripción de la opción
     * @param {Object} user - Usuario que envió el mensaje
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async processListResponse(flow, listId, listTitle, listDescription, user) {
        try {
            const currentStep = await this.getCurrentStep(flow, user);

            if (!currentStep || currentStep.type !== 'interactive') {
                logger.warn('⚠️ Paso actual no es interactivo', { flowId: flow.id });
                return null;
            }

            // Determinar el siguiente paso según la opción seleccionada
            const nextStep = this.getNextStep(flow, listId);

            if (nextStep) {
                await this.updateUserStep(user._id, flow.id, nextStep.id);
                return this.createStepResponse(nextStep, user);
            }

            return null;
        } catch (error) {
            logger.error('❌ Error procesando respuesta de lista:', error);
            throw error;
        }
    }

    /**
     * Obtiene el paso actual de un usuario en un flujo
     * @param {Object} flow - Flujo actual
     * @param {Object} user - Usuario
     * @returns {Promise<Object>} Paso actual
     */
    async getCurrentStep(flow, user) {
        try {
            const stepId = user.currentStep || flow.steps[0].id;
            return flow.steps.find(step => step.id === stepId);
        } catch (error) {
            logger.error('❌ Error obteniendo paso actual:', error);
            throw error;
        }
    }

    /**
     * Obtiene el siguiente paso en un flujo
     * @param {Object} flow - Flujo actual
     * @param {string} currentStepId - ID del paso actual
     * @returns {Object} Siguiente paso
     */
    getNextStep(flow, currentStepId) {
        const currentStepIndex = flow.steps.findIndex(step => step.id === currentStepId);

        if (currentStepIndex === -1 || currentStepIndex === flow.steps.length - 1) {
            return null;
        }

        return flow.steps[currentStepIndex + 1];
    }

    /**
     * Actualiza el paso actual de un usuario
     * @param {string} userId - ID del usuario
     * @param {string} flowId - ID del flujo
     * @param {string} stepId - ID del paso
     */
    async updateUserStep(userId, flowId, stepId) {
        try {
            await userService.updateUserFlow(userId, flowId, stepId);
        } catch (error) {
            logger.error('❌ Error actualizando paso del usuario:', error);
            throw error;
        }
    }

    /**
     * Crea una respuesta para un paso
     * @param {Object} step - Paso actual
     * @param {Object} user - Usuario
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async createStepResponse(step, user) {
        try {
            switch (step.type) {
                case 'text':
                    return {
                        type: 'text',
                        content: step.content
                    };
                case 'template':
                    const template = await templateService.getTemplate(step.template);
                    return {
                        type: 'template',
                        content: {
                            name: template.name,
                            language: template.language,
                            components: template.components
                        }
                    };
                case 'interactive':
                    return {
                        type: 'interactive',
                        content: step.content
                    };
                default:
                    logger.warn('⚠️ Tipo de paso no manejado', { type: step.type });
                    return null;
            }
        } catch (error) {
            logger.error('❌ Error creando respuesta de paso:', error);
            throw error;
        }
    }

    /**
     * Procesa un paso de texto
     * @param {Object} step - Paso actual
     * @param {string} message - Mensaje recibido
     * @param {Object} user - Usuario
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async processTextStep(step, message, user) {
        try {
            const nextStep = this.getNextStep(step.flow, step.id);

            if (nextStep) {
                await this.updateUserStep(user._id, step.flow.id, nextStep.id);
                return this.createStepResponse(nextStep, user);
            }

            return null;
        } catch (error) {
            logger.error('❌ Error procesando paso de texto:', error);
            throw error;
        }
    }

    /**
     * Procesa un paso de plantilla
     * @param {Object} step - Paso actual
     * @param {Object} user - Usuario
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async processTemplateStep(step, user) {
        try {
            const nextStep = this.getNextStep(step.flow, step.id);

            if (nextStep) {
                await this.updateUserStep(user._id, step.flow.id, nextStep.id);
                return this.createStepResponse(nextStep, user);
            }

            return null;
        } catch (error) {
            logger.error('❌ Error procesando paso de plantilla:', error);
            throw error;
        }
    }

    /**
     * Procesa un paso interactivo
     * @param {Object} step - Paso actual
     * @param {string} message - Mensaje recibido
     * @param {Object} user - Usuario
     * @returns {Promise<Object>} Respuesta a enviar
     */
    async processInteractiveStep(step, message, user) {
        try {
            // Los pasos interactivos se manejan a través de processButtonResponse y processListResponse
            return null;
        } catch (error) {
            logger.error('❌ Error procesando paso interactivo:', error);
            throw error;
        }
    }
}

module.exports = new FlowService(); 
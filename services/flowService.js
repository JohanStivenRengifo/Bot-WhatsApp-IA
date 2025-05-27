const logger = require('../utils/logger');
const userService = require('./userService');
const templateService = require('./templateService');
const agentService = require('./agentService');
const marketingService = require('./marketingService');

class FlowService {
    constructor() {
        this.whatsappService = require('./whatsappService');
        this.flows = new Map();
        this.initializeFlows();
    }

    async handleFlow(conversation, message) {
        try {
            // Si no hay flujo actual, iniciar con privacyFlow
            if (!conversation.currentFlow) {
                conversation.currentFlow = 'privacy';
                conversation.currentStep = 'notice';
                await conversation.save();
            }

            // Obtener el manejador del flujo actual
            const flow = this.getFlowHandler(conversation.currentFlow);
            if (!flow) {
                logger.error('Flujo no encontrado:', conversation.currentFlow);
                return null;
            }

            // Ejecutar el flujo actual
            const result = await flow.handleFlow(conversation, message);

            // Si el resultado indica cambio de flujo, actualizar y ejecutar el nuevo flujo
            if (result && result.flow) {
                conversation.currentFlow = result.flow;
                if (result.step) {
                    conversation.currentStep = result.step;
                }
                await conversation.save();

                // Si el nuevo flujo es 'main', mostrar menú principal
                if (result.flow === 'main') {
                    const mainFlow = this.getFlowHandler('main');
                    return await mainFlow.handleFlow(conversation, message);
                }

                // Ejecutar el nuevo flujo
                const newFlow = this.getFlowHandler(result.flow);
                if (newFlow) {
                    return await newFlow.handleFlow(conversation, message);
                }
            }

            return result;
        } catch (error) {
            logger.error('Error en handleFlow:', error);
            throw error;
        }
    }

    getFlowHandler(flowName) {
        try {
            // Si el flujo ya está inicializado, devolverlo
            if (this.flows.has(flowName)) {
                return this.flows.get(flowName);
            }

            // Cargar dinámicamente el flujo si existe
            try {
                const FlowClass = require(`../flows/${flowName}Flow.js`);
                const flowInstance = new FlowClass(this.whatsappService);
                this.flows.set(flowName, flowInstance);
                return flowInstance;
            } catch (error) {
                logger.error(`Error cargando flujo ${flowName}:`, error);
                return null;
            }
        } catch (error) {
            logger.error('Error en getFlowHandler:', error);
            return null;
        }
    }

    /**
     * Inicializa los flujos de conversación
     */
    initializeFlows() {
        try {
            // Pre-cargar los flujos principales
            const mainFlows = ['privacy', 'auth', 'main', 'support', 'facturas', 'pagos'];
            for (const flowName of mainFlows) {
                this.getFlowHandler(flowName);
            }
        } catch (error) {
            logger.error('Error inicializando flujos:', error);
            throw error;
        }
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

            // Manejar transferencia a agente
            if (buttonId === 'yes_agent') {
                const result = await agentService.transferToAgent(user._id, 'support');
                if (result.success) {
                    return await this.createStepResponse(currentStep.next, user);
                }
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

            // Manejar opciones de marketing
            if (listId === 'subscribe') {
                await marketingService.sendCampaign(user._id, 'welcome');
                return {
                    type: 'text',
                    content: '¡Gracias por suscribirte! Recibirás nuestras novedades.'
                };
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
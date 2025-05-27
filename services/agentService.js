const logger = require('../utils/logger');
const User = require('../models/User');
const metaApiService = require('./metaApiService');
const templateService = require('./templateService');

class AgentService {
    constructor() {
        this.agents = new Map();
        this.initializeAgents();
    }

    /**
     * Inicializa los agentes disponibles
     */
    initializeAgents() {
        this.agents.set('support', {
            id: 'support',
            name: 'Soporte General',
            description: 'Atención general y soporte técnico',
            availability: {
                monday: { start: '09:00', end: '18:00' },
                tuesday: { start: '09:00', end: '18:00' },
                wednesday: { start: '09:00', end: '18:00' },
                thursday: { start: '09:00', end: '18:00' },
                friday: { start: '09:00', end: '18:00' }
            }
        });

        this.agents.set('sales', {
            id: 'sales',
            name: 'Ventas',
            description: 'Atención comercial y ventas',
            availability: {
                monday: { start: '09:00', end: '20:00' },
                tuesday: { start: '09:00', end: '20:00' },
                wednesday: { start: '09:00', end: '20:00' },
                thursday: { start: '09:00', end: '20:00' },
                friday: { start: '09:00', end: '20:00' },
                saturday: { start: '10:00', end: '14:00' }
            }
        });
    }

    /**
     * Transfiere la conversación a un agente humano
     * @param {string} userId - ID del usuario
     * @param {string} agentType - Tipo de agente
     * @returns {Promise<Object>} Resultado de la transferencia
     */
    async transferToAgent(userId, agentType) {
        try {
            const user = await User.findById(userId);
            const agent = this.agents.get(agentType);

            if (!agent) {
                throw new Error('Tipo de agente no válido');
            }

            // Verificar disponibilidad del agente
            if (!this.isAgentAvailable(agent)) {
                await this.sendUnavailableMessage(user.phoneNumber, agent);
                return {
                    success: false,
                    message: 'Agente no disponible'
                };
            }

            // Actualizar estado del usuario
            user.currentFlow = 'agent';
            user.currentAgent = agentType;
            user.agentTransferTimestamp = new Date();
            await user.save();

            // Enviar mensaje de transferencia
            await this.sendTransferMessage(user.phoneNumber, agent);

            logger.info('✅ Conversación transferida a agente', {
                userId,
                agentType
            });

            return {
                success: true,
                agent: agent
            };
        } catch (error) {
            logger.error('❌ Error transfiriendo a agente:', error);
            throw error;
        }
    }

    /**
     * Verifica si un agente está disponible
     * @param {Object} agent - Agente a verificar
     * @returns {boolean} true si el agente está disponible
     */
    isAgentAvailable(agent) {
        const now = new Date();
        const day = now.toLocaleLowerCase('en-US', { weekday: 'long' });
        const time = now.toLocaleTimeString('en-US', { hour12: false });

        const schedule = agent.availability[day];
        if (!schedule) return false;

        return time >= schedule.start && time <= schedule.end;
    }

    /**
     * Envía mensaje de transferencia a agente
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} agent - Información del agente
     */
    async sendTransferMessage(phoneNumber, agent) {
        try {
            await metaApiService.sendTemplateMessage(
                phoneNumber,
                'agent_transfer',
                'es',
                [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: agent.name
                            }
                        ]
                    }
                ]
            );
        } catch (error) {
            logger.error('❌ Error enviando mensaje de transferencia:', error);
            throw error;
        }
    }

    /**
     * Envía mensaje de agente no disponible
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} agent - Información del agente
     */
    async sendUnavailableMessage(phoneNumber, agent) {
        try {
            await metaApiService.sendTemplateMessage(
                phoneNumber,
                'agent_unavailable',
                'es',
                [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: agent.name
                            }
                        ]
                    }
                ]
            );
        } catch (error) {
            logger.error('❌ Error enviando mensaje de no disponibilidad:', error);
            throw error;
        }
    }

    /**
     * Finaliza la conversación con el agente
     * @param {string} userId - ID del usuario
     * @returns {Promise<Object>} Resultado de la finalización
     */
    async endAgentConversation(userId) {
        try {
            const user = await User.findById(userId);

            // Actualizar estado del usuario
            user.currentFlow = 'welcome';
            user.currentStep = 'greeting';
            user.currentAgent = null;
            user.agentTransferTimestamp = null;
            await user.save();

            // Enviar mensaje de despedida
            await metaApiService.sendTemplateMessage(
                user.phoneNumber,
                'agent_goodbye',
                'es'
            );

            logger.info('✅ Conversación con agente finalizada', {
                userId
            });

            return {
                success: true
            };
        } catch (error) {
            logger.error('❌ Error finalizando conversación con agente:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial de conversaciones con agentes
     * @param {string} userId - ID del usuario
     * @returns {Promise<Array>} Historial de conversaciones
     */
    async getAgentConversationHistory(userId) {
        try {
            const user = await User.findById(userId);
            const conversations = await Message.find({
                userId,
                type: 'agent_conversation'
            }).sort({ timestamp: -1 });

            return conversations;
        } catch (error) {
            logger.error('❌ Error obteniendo historial de conversaciones con agentes:', error);
            throw error;
        }
    }
}

module.exports = new AgentService(); 
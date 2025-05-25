// controllers/conversationController.js
const Conversation = require('../models/conversation');
const whatsappService = require('../services/whatsappService');

class ConversationController {
    /**
     * Obtiene todas las conversaciones
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async getAllConversations(req, res) {
        try {
            // Parámetros de paginación
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            // Filtros opcionales
            const filters = {};
            if (req.query.isActive) {
                filters.isActive = req.query.isActive === 'true';
            }
            if (req.query.currentFlow) {
                filters.currentFlow = req.query.currentFlow;
            }

            // Obtener conversaciones con paginación
            const conversations = await Conversation.find(filters)
                .sort({ lastActivity: -1 })
                .skip(skip)
                .limit(limit)
                .select('-messages'); // Excluir mensajes para reducir tamaño

            // Contar total para paginación
            const total = await Conversation.countDocuments(filters);

            return res.status(200).json({
                success: true,
                data: {
                    conversations,
                    pagination: {
                        total,
                        page,
                        limit,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error obteniendo conversaciones:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error obteniendo conversaciones'
            });
        }
    }

    /**
     * Obtiene una conversación por número de teléfono
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async getConversationByPhone(req, res) {
        try {
            const { phoneNumber } = req.params;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el número de teléfono'
                });
            }

            // Buscar conversación
            const conversation = await Conversation.findOne({ phoneNumber });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
            }

            return res.status(200).json({
                success: true,
                data: conversation
            });
        } catch (error) {
            console.error(`❌ Error obteniendo conversación para ${req.params.phoneNumber}:`, error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error obteniendo conversación'
            });
        }
    }

    /**
     * Reinicia una conversación a su estado inicial
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async resetConversation(req, res) {
        try {
            const { phoneNumber } = req.params;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere el número de teléfono'
                });
            }

            // Buscar y actualizar conversación
            const conversation = await Conversation.findOne({ phoneNumber });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
            }

            // Reiniciar estado
            conversation.currentFlow = 'main';
            conversation.currentStep = 'welcome';
            conversation.userData = {};
            conversation.isActive = true;
            conversation.lastActivity = new Date();

            // Guardar cambios
            await conversation.save();

            // Enviar mensaje de bienvenida
            await whatsappService.sendTextMessage(
                phoneNumber,
                "Tu conversación ha sido reiniciada. ¿En qué puedo ayudarte?"
            );

            return res.status(200).json({
                success: true,
                message: 'Conversación reiniciada exitosamente',
                data: conversation
            });
        } catch (error) {
            console.error(`❌ Error reiniciando conversación para ${req.params.phoneNumber}:`, error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error reiniciando conversación'
            });
        }
    }

    /**
     * Obtiene estadísticas de conversaciones
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    async getConversationStats(req, res) {
        try {
            // Período de tiempo (por defecto últimos 30 días)
            const days = parseInt(req.query.days) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Estadísticas generales
            const totalConversations = await Conversation.countDocuments();
            const activeConversations = await Conversation.countDocuments({ isActive: true });
            const recentConversations = await Conversation.countDocuments({
                lastActivity: { $gte: startDate }
            });

            // Distribución por flujo
            const flowDistribution = await Conversation.aggregate([
                { $match: { lastActivity: { $gte: startDate } } },
                { $group: { _id: "$currentFlow", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Promedio de mensajes por conversación
            const messageCounts = await Conversation.aggregate([
                { $match: { lastActivity: { $gte: startDate } } },
                { $project: { messageCount: { $size: "$messages" } } },
                { $group: { _id: null, avgMessages: { $avg: "$messageCount" } } }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    totalConversations,
                    activeConversations,
                    recentConversations,
                    avgMessagesPerConversation: messageCounts.length > 0 ? Math.round(messageCounts[0].avgMessages) : 0,
                    flowDistribution: flowDistribution.map(item => ({
                        flow: item._id,
                        count: item.count
                    }))
                }
            });
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de conversaciones:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error obteniendo estadísticas'
            });
        }
    }
}

module.exports = new ConversationController();
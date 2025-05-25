const Conversation = require('../models/conversation');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');
const tokenManager = require('../utils/tokenManager');

class DashboardController {
    async getStats(req, res) {
        try {
            const totalConversations = await Conversation.countDocuments();
            const activeConversations = await Conversation.countDocuments({ isActive: true });
            const lastDayConversations = await Conversation.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            const stats = {
                total: totalConversations,
                active: activeConversations,
                lastDay: lastDayConversations
            };

            return res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error obteniendo estadísticas:', error);
            return res.status(500).json({
                success: false,
                error: 'Error obteniendo estadísticas'
            });
        }
    }

    async getActiveConversations(req, res) {
        try {
            const conversations = await Conversation.find({ isActive: true })
                .select('phoneNumber userName currentFlow lastActivity')
                .sort('-lastActivity')
                .limit(10);

            return res.status(200).json({
                success: true,
                data: conversations
            });
        } catch (error) {
            logger.error('Error obteniendo conversaciones activas:', error);
            return res.status(500).json({
                success: false,
                error: 'Error obteniendo conversaciones activas'
            });
        }
    }

    async generateNewToken(req, res) {
        try {
            const { type = 'api' } = req.body;
            const token = tokenManager.generateToken(type);

            return res.status(200).json({
                success: true,
                data: {
                    token,
                    type
                }
            });
        } catch (error) {
            logger.error('Error generando token:', error);
            return res.status(500).json({
                success: false,
                error: 'Error generando token'
            });
        }
    }

    async handoverToHuman(req, res) {
        try {
            const { phoneNumber } = req.params;
            const conversation = await Conversation.findOne({ phoneNumber });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
            }

            // Actualizar estado de la conversación
            conversation.isHandedOverToHuman = true;
            conversation.handoverTimestamp = new Date();
            await conversation.save();

            // Notificar al usuario
            await whatsappService.sendTextMessage(
                phoneNumber,
                "Un asesor humano continuará con tu atención. Por favor, espera un momento."
            );

            return res.status(200).json({
                success: true,
                message: 'Conversación transferida exitosamente'
            });
        } catch (error) {
            logger.error('Error en handover:', error);
            return res.status(500).json({
                success: false,
                error: 'Error transfiriendo conversación'
            });
        }
    }

    async returnToBot(req, res) {
        try {
            const { phoneNumber } = req.params;
            const conversation = await Conversation.findOne({ phoneNumber });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversación no encontrada'
                });
            }

            // Actualizar estado de la conversación
            conversation.isHandedOverToHuman = false;
            conversation.currentFlow = 'main';
            conversation.currentStep = 'welcome';
            await conversation.save();

            // Notificar al usuario
            await whatsappService.sendTextMessage(
                phoneNumber,
                "Has vuelto a la atención automatizada. ¿En qué puedo ayudarte?"
            );

            return res.status(200).json({
                success: true,
                message: 'Conversación devuelta al bot exitosamente'
            });
        } catch (error) {
            logger.error('Error retornando al bot:', error);
            return res.status(500).json({
                success: false,
                error: 'Error retornando conversación al bot'
            });
        }
    }
}

module.exports = new DashboardController();

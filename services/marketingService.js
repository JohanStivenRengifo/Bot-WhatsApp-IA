const logger = require('../utils/logger');
const User = require('../models/User');
const metaApiService = require('./metaApiService');
const templateService = require('./templateService');

class MarketingService {
    constructor() {
        this.campaigns = new Map();
        this.initializeCampaigns();
    }

    /**
     * Inicializa las campañas de marketing
     */
    initializeCampaigns() {
        this.campaigns.set('welcome', {
            id: 'welcome',
            name: 'Bienvenida',
            type: 'template',
            template: 'welcome_message',
            trigger: 'first_interaction'
        });

        this.campaigns.set('promo_weekend', {
            id: 'promo_weekend',
            name: 'Promoción de Fin de Semana',
            type: 'template',
            template: 'weekend_promo',
            trigger: 'scheduled',
            schedule: {
                day: 'friday',
                time: '10:00'
            }
        });

        this.campaigns.set('abandoned_cart', {
            id: 'abandoned_cart',
            name: 'Carrito Abandonado',
            type: 'template',
            template: 'cart_reminder',
            trigger: 'event',
            event: 'cart_abandoned',
            delay: 24 // horas
        });
    }

    /**
     * Envía una campaña a un usuario específico
     * @param {string} userId - ID del usuario
     * @param {string} campaignId - ID de la campaña
     * @returns {Promise<Object>} Resultado del envío
     */
    async sendCampaign(userId, campaignId) {
        try {
            const user = await User.findById(userId);
            const campaign = this.campaigns.get(campaignId);

            if (!campaign) {
                throw new Error('Campaña no encontrada');
            }

            // Verificar si el usuario ya recibió esta campaña
            if (await this.hasReceivedCampaign(userId, campaignId)) {
                logger.warn('⚠️ Usuario ya recibió esta campaña', {
                    userId,
                    campaignId
                });
                return {
                    success: false,
                    message: 'Usuario ya recibió esta campaña'
                };
            }

            // Enviar mensaje según el tipo de campaña
            switch (campaign.type) {
                case 'template':
                    await this.sendTemplateCampaign(user.phoneNumber, campaign);
                    break;
                case 'interactive':
                    await this.sendInteractiveCampaign(user.phoneNumber, campaign);
                    break;
                case 'media':
                    await this.sendMediaCampaign(user.phoneNumber, campaign);
                    break;
                default:
                    throw new Error('Tipo de campaña no soportado');
            }

            // Registrar el envío
            await this.recordCampaignSend(userId, campaignId);

            logger.info('✅ Campaña enviada exitosamente', {
                userId,
                campaignId
            });

            return {
                success: true
            };
        } catch (error) {
            logger.error('❌ Error enviando campaña:', error);
            throw error;
        }
    }

    /**
     * Envía una campaña basada en plantilla
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} campaign - Datos de la campaña
     */
    async sendTemplateCampaign(phoneNumber, campaign) {
        try {
            await metaApiService.sendTemplateMessage(
                phoneNumber,
                campaign.template,
                'es',
                campaign.components || []
            );
        } catch (error) {
            logger.error('❌ Error enviando campaña de plantilla:', error);
            throw error;
        }
    }

    /**
     * Envía una campaña interactiva
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} campaign - Datos de la campaña
     */
    async sendInteractiveCampaign(phoneNumber, campaign) {
        try {
            await metaApiService.sendInteractiveMessage(
                phoneNumber,
                campaign.content
            );
        } catch (error) {
            logger.error('❌ Error enviando campaña interactiva:', error);
            throw error;
        }
    }

    /**
     * Envía una campaña multimedia
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} campaign - Datos de la campaña
     */
    async sendMediaCampaign(phoneNumber, campaign) {
        try {
            await metaApiService.sendMediaMessage(
                phoneNumber,
                campaign.mediaType,
                campaign.mediaUrl,
                campaign.caption
            );
        } catch (error) {
            logger.error('❌ Error enviando campaña multimedia:', error);
            throw error;
        }
    }

    /**
     * Verifica si un usuario ya recibió una campaña
     * @param {string} userId - ID del usuario
     * @param {string} campaignId - ID de la campaña
     * @returns {Promise<boolean>} true si el usuario ya recibió la campaña
     */
    async hasReceivedCampaign(userId, campaignId) {
        try {
            const user = await User.findById(userId);
            return user.receivedCampaigns?.includes(campaignId) || false;
        } catch (error) {
            logger.error('❌ Error verificando campaña recibida:', error);
            throw error;
        }
    }

    /**
     * Registra el envío de una campaña
     * @param {string} userId - ID del usuario
     * @param {string} campaignId - ID de la campaña
     */
    async recordCampaignSend(userId, campaignId) {
        try {
            const user = await User.findById(userId);

            if (!user.receivedCampaigns) {
                user.receivedCampaigns = [];
            }

            user.receivedCampaigns.push(campaignId);
            await user.save();

            logger.info('✅ Envío de campaña registrado', {
                userId,
                campaignId
            });
        } catch (error) {
            logger.error('❌ Error registrando envío de campaña:', error);
            throw error;
        }
    }

    /**
     * Programa una campaña para envío masivo
     * @param {string} campaignId - ID de la campaña
     * @param {Object} schedule - Programación de la campaña
     * @returns {Promise<Object>} Resultado de la programación
     */
    async scheduleCampaign(campaignId, schedule) {
        try {
            const campaign = this.campaigns.get(campaignId);

            if (!campaign) {
                throw new Error('Campaña no encontrada');
            }

            campaign.schedule = schedule;
            this.campaigns.set(campaignId, campaign);

            logger.info('✅ Campaña programada', {
                campaignId,
                schedule
            });

            return {
                success: true,
                campaign
            };
        } catch (error) {
            logger.error('❌ Error programando campaña:', error);
            throw error;
        }
    }

    /**
     * Obtiene las estadísticas de una campaña
     * @param {string} campaignId - ID de la campaña
     * @returns {Promise<Object>} Estadísticas de la campaña
     */
    async getCampaignStats(campaignId) {
        try {
            const campaign = this.campaigns.get(campaignId);

            if (!campaign) {
                throw new Error('Campaña no encontrada');
            }

            // Obtener usuarios que recibieron la campaña
            const users = await User.find({
                receivedCampaigns: campaignId
            });

            // Calcular estadísticas
            const stats = {
                totalSent: users.length,
                delivered: users.filter(u => u.campaignStatus?.[campaignId]?.delivered).length,
                read: users.filter(u => u.campaignStatus?.[campaignId]?.read).length,
                responded: users.filter(u => u.campaignStatus?.[campaignId]?.responded).length
            };

            return stats;
        } catch (error) {
            logger.error('❌ Error obteniendo estadísticas de campaña:', error);
            throw error;
        }
    }
}

module.exports = new MarketingService(); 
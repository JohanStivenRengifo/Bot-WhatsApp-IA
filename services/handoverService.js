// services/handoverService.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class HandoverService {
    constructor() {
        this.baseURL = 'https://graph.facebook.com';
        this.version = 'v22.0';
        this.accountId = config.meta.businessAccountId;
    }

    async passThreadControl(phoneNumberId, metadata = '') {
        try {
            const url = `${this.baseURL}/${this.version}/${this.accountId}/pass_thread_control`;
            const response = await axios.post(url, {
                recipient: { id: phoneNumberId },
                target_app_id: config.meta.crmAppId,
                metadata
            }, {
                headers: {
                    'Authorization': `Bearer ${config.meta.jwtToken}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info('Handover exitoso:', {
                phoneNumberId,
                response: response.data
            });

            return response.data;
        } catch (error) {
            logger.error('Error en handover:', error);
            throw new Error('Error al transferir la conversación');
        }
    }

    async takeThreadControl(phoneNumberId, metadata = '') {
        try {
            const url = `${this.baseURL}/${this.version}/${this.accountId}/take_thread_control`;
            const response = await axios.post(url, {
                recipient: { id: phoneNumberId },
                metadata
            }, {
                headers: {
                    'Authorization': `Bearer ${config.meta.jwtToken}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info('Recuperación de control exitosa:', {
                phoneNumberId,
                response: response.data
            });

            return response.data;
        } catch (error) {
            logger.error('Error recuperando control:', error);
            throw new Error('Error al recuperar el control de la conversación');
        }
    }
}

module.exports = new HandoverService();

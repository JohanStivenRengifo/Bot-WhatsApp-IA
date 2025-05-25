const validator = require('validator');
const logger = require('./logger');

class InputSanitizer {
    sanitizePhoneNumber(phone) {
        if (!phone) return '';
        // Remover todos los caracteres no numéricos
        return phone.replace(/[^\d]/g, '');
    }

    sanitizeText(text) {
        if (!text) return '';
        // Remover caracteres especiales y HTML
        return validator.escape(text.trim());
    }

    validatePhoneNumber(phone) {
        const cleanPhone = this.sanitizePhoneNumber(phone);
        return /^\d{10,15}$/.test(cleanPhone);
    }

    validateEmail(email) {
        return validator.isEmail(email);
    }

    validateWebhookPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }

        const requiredFields = ['object', 'entry'];
        for (const field of requiredFields) {
            if (!(field in payload)) {
                return false;
            }
        }

        return true;
    }

    sanitizeConversationData(data) {
        if (!data || typeof data !== 'object') {
            return {};
        }

        const sanitized = {};

        if ('phoneNumber' in data) {
            sanitized.phoneNumber = this.sanitizePhoneNumber(data.phoneNumber);
        }

        if ('userName' in data) {
            sanitized.userName = this.sanitizeText(data.userName);
        }

        if ('message' in data) {
            sanitized.message = this.sanitizeText(data.message);
        }

        return sanitized;
    }

    validateApiRequest(req) {
        const token = req.headers['x-api-token'];
        if (!token) {
            return {
                isValid: false,
                error: 'Token no proporcionado'
            };
        }

        if (!validator.isJWT(token)) {
            return {
                isValid: false,
                error: 'Token inválido'
            };
        }

        return { isValid: true };
    }

    logSanitizationError(context, originalData, error) {
        logger.warn('Error en sanitización de datos:', {
            context,
            originalData: JSON.stringify(originalData),
            error: error.message
        });
    }
}

module.exports = new InputSanitizer();

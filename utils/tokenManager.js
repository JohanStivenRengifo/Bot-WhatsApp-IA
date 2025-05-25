const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class TokenManager {
    constructor() {
        this.tokenPath = path.join(__dirname, '../.env.tokens');
        this.tokens = this.loadTokens();
    }

    loadTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                const data = fs.readFileSync(this.tokenPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            logger.error('Error loading tokens:', error);
        }
        return {};
    }

    saveTokens() {
        try {
            fs.writeFileSync(this.tokenPath, JSON.stringify(this.tokens, null, 2));
        } catch (error) {
            logger.error('Error saving tokens:', error);
        }
    }

    generateToken(type = 'api', expiresIn = '30d') {
        const token = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + parseInt(expiresIn));

        this.tokens[type] = {
            token,
            expiresAt: expirationDate,
            createdAt: new Date()
        };

        this.saveTokens();
        return token;
    }

    validateToken(token, type = 'api') {
        const tokenData = this.tokens[type];
        if (!tokenData) return false;

        if (tokenData.token !== token) return false;

        const now = new Date();
        if (new Date(tokenData.expiresAt) < now) {
            return false;
        }

        return true;
    }

    refreshToken(type = 'api') {
        return this.generateToken(type);
    }

    getToken(type = 'api') {
        const tokenData = this.tokens[type];
        if (!tokenData) return null;

        const now = new Date();
        if (new Date(tokenData.expiresAt) < now) {
            return this.refreshToken(type);
        }

        return tokenData.token;
    }
}

module.exports = new TokenManager();

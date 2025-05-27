// flows/authFlow.js
const WisphubService = require('../services/wisphubService');
const logger = require('../utils/logger');

class AuthFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.wisphubService = new WisphubService();
    }

    async handleFlow(conversation, message) {
        try {
            const step = conversation.currentStep || 'inicio';

            switch (step) {
                case 'inicio':
                    return await this.handleInicio(conversation);
                case 'solicitar_consentimiento':
                    return await this.handleConsentimientoResponse(conversation, message);
                case 'solicitar_cedula':
                    return await this.handleCedula(conversation, message);
                case 'menu_autenticado':
                    return { flow: 'main', step: 'menu' };
                default:
                    return await this.handleInicio(conversation);
            }
        } catch (error) {
            logger.error('Error en AuthFlow:', error);
            throw error;
        }
    }

    async handleInicio(conversation) {
        try {
            conversation.currentStep = 'solicitar_consentimiento';
            await conversation.save();

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                '🔐 Autenticación de Usuario\n\n' +
                'Para brindarte un servicio personalizado y acceso a tus facturas, servicios y soporte técnico, ' +
                'necesitamos verificar tu identidad.\n\n' +
                'Tus datos serán tratados con confidencialidad y solo se utilizarán para mejorar tu experiencia con nuestro servicio.'
            );

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                'Consentimiento\n' +
                '¿Nos autorizas a verificar tu identidad con tu número de cédula?'
            );

            return null;
        } catch (error) {
            logger.error('Error en inicio de autenticación:', error);
            throw error;
        }
    }

    async handleConsentimientoResponse(conversation, message) {
        const response = message.text ? message.text.trim().toLowerCase() : '';

        // Lista de posibles respuestas afirmativas
        const respuestasAfirmativas = [
            '✅ acepto continuar',
            'acepto continuar',
            'acepto',
            'si acepto',
            'sí acepto',
            'si',
            'sí'
        ];

        if (respuestasAfirmativas.includes(response)) {
            conversation.currentStep = 'solicitar_cedula';
            await conversation.save();

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                '👤 Por favor, ingresa tu número de cédula (solo números):'
            );
            return null;
        }

        // Si la respuesta no es válida
        await this.whatsappService.sendTextMessage(
            conversation.phoneNumber,
            'Por favor, responde "✅ Acepto continuar" para proceder con la verificación o "No acepto" para cancelar.'
        );
        return null;
    }

    async handleCedula(conversation, message) {
        try {
            const cedula = message.text.trim();

            // Validar formato de cédula
            if (!/^\d{8,12}$/.test(cedula)) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    '❌ El número de cédula no es válido. Por favor, ingresa solo números (8-12 dígitos).'
                );
                return null;
            }

            // Verificar usuario en Wisphub
            const userData = await this.wisphubService.validateCustomer(cedula);

            if (userData && userData.success) {
                // Guardar datos del usuario
                conversation.userData = {
                    ...userData,
                    authenticated: true,
                    cedula: cedula
                };
                conversation.currentFlow = 'main';
                conversation.currentStep = 'menu';
                await conversation.save();

                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    `✅ ¡Autenticación exitosa!\n\nBienvenido(a) ${userData.nombreCompleto || 'Usuario'}`
                );

                return { flow: 'main', step: 'menu' };
            } else {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    '❌ No pudimos verificar tu identidad. Por favor, verifica el número de cédula e intenta nuevamente.'
                );
                return null;
            }
        } catch (error) {
            logger.error('Error en autenticación:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                '❌ Ocurrió un error al verificar tu identidad. Por favor, intenta nuevamente más tarde.'
            );
            return null;
        }
    }
}

module.exports = AuthFlow;

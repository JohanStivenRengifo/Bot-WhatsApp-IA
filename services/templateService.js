const logger = require('../utils/logger');
const metaApiService = require('./metaApiService');
const config = require('../config');

class TemplateService {
    constructor() {
        this.templates = new Map();
        this.initializeTemplates();
    }

    /**
     * Inicializa las plantillas de mensajes
     */
    initializeTemplates() {
        // Plantilla de bienvenida
        this.templates.set('welcome_message', {
            name: 'welcome_message',
            language: 'es',
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'text',
                            text: '¡Bienvenido!'
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: 'Gracias por contactarnos. ¿En qué podemos ayudarte hoy?'
                        }
                    ]
                }
            ]
        });

        // Plantilla de confirmación
        this.templates.set('confirmation_message', {
            name: 'confirmation_message',
            language: 'es',
            components: [
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: 'Tu solicitud ha sido recibida. Te contactaremos pronto.'
                        }
                    ]
                }
            ]
        });

        // Plantilla de recordatorio
        this.templates.set('reminder_message', {
            name: 'reminder_message',
            language: 'es',
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'text',
                            text: 'Recordatorio'
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: 'No olvides tu cita programada para mañana.'
                        }
                    ]
                }
            ]
        });
    }

    /**
     * Obtiene una plantilla por su nombre
     * @param {string} templateName - Nombre de la plantilla
     * @returns {Promise<Object>} Plantilla encontrada
     */
    async getTemplate(templateName) {
        try {
            const template = this.templates.get(templateName);

            if (!template) {
                logger.error('❌ Plantilla no encontrada', { templateName });
                throw new Error('Plantilla no encontrada');
            }

            return template;
        } catch (error) {
            logger.error('❌ Error obteniendo plantilla:', error);
            throw error;
        }
    }

    /**
     * Crea una nueva plantilla
     * @param {Object} templateData - Datos de la plantilla
     * @returns {Promise<Object>} Plantilla creada
     */
    async createTemplate(templateData) {
        try {
            const { name, language, components } = templateData;

            logger.info('📝 Creando nueva plantilla', {
                name,
                language
            });

            // Verificar si la plantilla ya existe
            if (this.templates.has(name)) {
                logger.warn('⚠️ Plantilla ya existe', { name });
                throw new Error('La plantilla ya existe');
            }

            // Crear la plantilla en la API de Meta
            const response = await metaApiService.makeRequest(
                'POST',
                `${config.meta.businessAccountId}/message_templates`,
                {
                    name,
                    language,
                    components
                }
            );

            // Guardar la plantilla localmente
            this.templates.set(name, {
                name,
                language,
                components,
                status: 'APPROVED',
                id: response.id
            });

            logger.info('✅ Plantilla creada exitosamente', {
                name,
                id: response.id
            });

            return this.templates.get(name);
        } catch (error) {
            logger.error('❌ Error creando plantilla:', error);
            throw error;
        }
    }

    /**
     * Actualiza una plantilla existente
     * @param {string} templateName - Nombre de la plantilla
     * @param {Object} templateData - Nuevos datos de la plantilla
     * @returns {Promise<Object>} Plantilla actualizada
     */
    async updateTemplate(templateName, templateData) {
        try {
            const template = await this.getTemplate(templateName);

            logger.info('📝 Actualizando plantilla', {
                name: templateName
            });

            // Actualizar la plantilla en la API de Meta
            const response = await metaApiService.makeRequest(
                'POST',
                `${config.meta.businessAccountId}/message_templates`,
                {
                    name: templateName,
                    language: templateData.language || template.language,
                    components: templateData.components || template.components
                }
            );

            // Actualizar la plantilla localmente
            this.templates.set(templateName, {
                ...template,
                ...templateData,
                status: 'APPROVED',
                id: response.id
            });

            logger.info('✅ Plantilla actualizada exitosamente', {
                name: templateName,
                id: response.id
            });

            return this.templates.get(templateName);
        } catch (error) {
            logger.error('❌ Error actualizando plantilla:', error);
            throw error;
        }
    }

    /**
     * Elimina una plantilla
     * @param {string} templateName - Nombre de la plantilla
     * @returns {Promise<boolean>} true si la plantilla fue eliminada
     */
    async deleteTemplate(templateName) {
        try {
            const template = await this.getTemplate(templateName);

            logger.info('🗑️ Eliminando plantilla', {
                name: templateName
            });

            // Eliminar la plantilla en la API de Meta
            await metaApiService.makeRequest(
                'DELETE',
                `${config.meta.businessAccountId}/message_templates/${template.id}`
            );

            // Eliminar la plantilla localmente
            this.templates.delete(templateName);

            logger.info('✅ Plantilla eliminada exitosamente', {
                name: templateName
            });

            return true;
        } catch (error) {
            logger.error('❌ Error eliminando plantilla:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado de una plantilla
     * @param {string} templateId - ID de la plantilla
     * @param {string} event - Evento de actualización
     */
    async updateTemplateStatus(templateId, event) {
        try {
            logger.info('📝 Actualizando estado de plantilla', {
                templateId,
                event
            });

            // Buscar la plantilla por ID
            const template = Array.from(this.templates.values()).find(t => t.id === templateId);

            if (template) {
                template.status = event;
                this.templates.set(template.name, template);

                logger.info('✅ Estado de plantilla actualizado', {
                    templateId,
                    status: event
                });
            } else {
                logger.warn('⚠️ Plantilla no encontrada para actualizar estado', {
                    templateId
                });
            }
        } catch (error) {
            logger.error('❌ Error actualizando estado de plantilla:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las plantillas
     * @returns {Promise<Array>} Lista de plantillas
     */
    async getAllTemplates() {
        try {
            // Obtener plantillas de la API de Meta
            const response = await metaApiService.makeRequest(
                'GET',
                `${config.meta.businessAccountId}/message_templates`
            );

            // Actualizar plantillas locales
            for (const template of response.data) {
                this.templates.set(template.name, {
                    name: template.name,
                    language: template.language,
                    components: template.components,
                    status: template.status,
                    id: template.id
                });
            }

            return Array.from(this.templates.values());
        } catch (error) {
            logger.error('❌ Error obteniendo plantillas:', error);
            throw error;
        }
    }
}

module.exports = new TemplateService(); 
import express, { Request, Response } from 'express';
import ConversationEnhancementService from '../services/ConversationEnhancementService';
import { ConversationTag } from '../interfaces/CRM';
import { HealthMonitorMiddleware } from '../middleware/healthMonitor';

const router = express.Router();
const enhancementService = ConversationEnhancementService.getInstance();
const healthMonitor = HealthMonitorMiddleware.getInstance();

/**
 * Ruta para obtener el estado de salud del sistema
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const healthStatus = healthMonitor.getHealthStatus();
        const overallHealth = healthStatus.azureOpenAI.isHealthy;

        res.status(overallHealth ? 200 : 503).json({
            success: true,
            data: {
                overall: overallHealth ? 'healthy' : 'unhealthy',
                services: healthStatus,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting health status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get health status'
        });
    }
});

/**
 * Ruta para forzar verificación de salud
 */
router.post('/health/check', async (req: Request, res: Response) => {
    try {
        await healthMonitor.forceHealthCheck();
        const healthStatus = healthMonitor.getHealthStatus();

        res.json({
            success: true,
            message: 'Health check completed',
            data: healthStatus
        });
    } catch (error) {
        console.error('Error forcing health check:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform health check'
        });
    }
});

/**
 * Rutas para gestión de etiquetas
 */

// Obtener todas las etiquetas
router.get('/tags', async (req: Request, res: Response) => {
    try {
        const tags = await enhancementService.getAllTags();
        res.json({
            success: true,
            data: tags
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las etiquetas'
        });
    }
});

// Crear nueva etiqueta
router.post('/tags', async (req: Request, res: Response) => {
    try {
        const tagData: Partial<ConversationTag> = req.body;
        const userId = req.body.userId || 'system'; // Se debería obtener del token de autenticación

        // Validar datos requeridos
        if (!tagData.name || !tagData.color) {
            res.status(400).json({
                success: false,
                error: 'Nombre y color son requeridos'
            });
            return;
        }

        const newTag = await enhancementService.createTag(tagData as Omit<ConversationTag, 'id' | 'createdAt'>, userId);
        res.status(201).json({
            success: true,
            data: newTag
        });
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear la etiqueta'
        });
    }
});

// Actualizar etiqueta
router.put('/tags/:tagId', async (req: Request, res: Response) => {
    try {
        const { tagId } = req.params;
        const updates = req.body;

        const updatedTag = await enhancementService.updateTag(tagId, updates);

        if (!updatedTag) {
            res.status(404).json({
                success: false,
                error: 'Etiqueta no encontrada'
            });
            return;
        }

        res.json({
            success: true,
            data: updatedTag
        });
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar la etiqueta'
        });
    }
});

// Eliminar etiqueta
router.delete('/tags/:tagId', async (req: Request, res: Response) => {
    try {
        const { tagId } = req.params;

        const deleted = await enhancementService.deleteTag(tagId);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Etiqueta no encontrada o no se puede eliminar'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Etiqueta eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error al eliminar la etiqueta'
        });
    }
});

// Estadísticas de uso de etiquetas
router.get('/tags/stats', async (req: Request, res: Response) => {
    try {
        const stats = await enhancementService.getTagUsageStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching tag stats:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas de etiquetas'
        });
    }
});

// Estadísticas de prioridades
router.get('/priorities/stats', async (req: Request, res: Response) => {
    try {
        const stats = await enhancementService.getPriorityStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching priority stats:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas de prioridades'
        });
    }
});

/**
 * Rutas para gestión de conversaciones y etiquetas
 */

// Agregar etiquetas a conversación
router.post('/conversations/:conversationId/tags', async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { tagIds } = req.body;

        if (!Array.isArray(tagIds)) {
            res.status(400).json({
                success: false,
                error: 'tagIds debe ser un array'
            });
            return;
        }

        const success = await enhancementService.addTagsToConversation(conversationId, tagIds);

        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Etiquetas agregadas exitosamente'
        });
    } catch (error) {
        console.error('Error adding tags to conversation:', error);
        res.status(500).json({
            success: false,
            error: 'Error al agregar etiquetas a la conversación'
        });
    }
});

// Quitar etiquetas de conversación
router.delete('/conversations/:conversationId/tags', async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { tagIds } = req.body;

        if (!Array.isArray(tagIds)) {
            res.status(400).json({
                success: false,
                error: 'tagIds debe ser un array'
            });
            return;
        }

        const success = await enhancementService.removeTagsFromConversation(conversationId, tagIds);

        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Etiquetas removidas exitosamente'
        });
    } catch (error) {
        console.error('Error removing tags from conversation:', error);
        res.status(500).json({
            success: false,
            error: 'Error al quitar etiquetas de la conversación'
        });
    }
});

// Obtener conversaciones por etiquetas
router.get('/conversations/by-tags', async (req: Request, res: Response) => {
    try {
        const { tagIds } = req.query;

        if (!tagIds) {
            res.status(400).json({
                success: false,
                error: 'tagIds es requerido'
            });
            return;
        }

        // Por ahora devolvemos un array vacío ya que el método no está implementado
        // TODO: Implementar getConversationsByTags en el servicio
        const conversations: any[] = [];

        res.json({
            success: true,
            data: conversations,
            message: 'Método pendiente de implementación'
        });
    } catch (error) {
        console.error('Error fetching conversations by tags:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener conversaciones por etiquetas'
        });
    }
});

/**
 * Rutas para gestión de agentes
 */

// Obtener agentes activos
router.get('/agents/active', async (req: Request, res: Response) => {
    try {
        // Por ahora devolvemos un array vacío ya que el método no está implementado
        // TODO: Implementar getActiveAgents en el servicio
        const activeAgents: any[] = [];

        res.json({
            success: true,
            data: activeAgents,
            message: 'Método pendiente de implementación'
        });
    } catch (error) {
        console.error('Error fetching active agents:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener agentes activos'
        });
    }
});

// Asignar agente a conversación
router.post('/conversations/:conversationId/assign-agent', async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { agentId, autoAssign } = req.body;

        if (!agentId && !autoAssign) {
            res.status(400).json({
                success: false,
                error: 'Se requiere agentId o autoAssign=true'
            });
            return;
        }

        let assignment;
        if (autoAssign) {
            // Para asignación automática, usamos el método público assignAgentToConversation sin agentId
            assignment = await enhancementService.assignAgentToConversation(conversationId);
        } else {
            assignment = await enhancementService.assignAgentToConversation(conversationId, agentId);
        }

        if (!assignment) {
            res.status(404).json({
                success: false,
                error: 'No se pudo realizar la asignación'
            });
            return;
        }

        res.json({
            success: true,
            data: assignment
        });
    } catch (error) {
        console.error('Error assigning agent:', error);
        res.status(500).json({
            success: false,
            error: 'Error al asignar agente'
        });
    }
});

// Liberar agente de conversación
router.delete('/conversations/:conversationId/agent', async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;

        const success = await enhancementService.unassignAgentFromConversation(conversationId);

        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Conversación no encontrada o no tiene agente asignado'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Agente liberado exitosamente'
        });
    } catch (error) {
        console.error('Error unassigning agent:', error);
        res.status(500).json({
            success: false,
            error: 'Error al liberar agente'
        });
    }
});

// Obtener métricas de asignación de agentes
router.get('/agents/metrics', async (req: Request, res: Response) => {
    try {
        const metrics = await enhancementService.getAgentMetrics();
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error fetching agent metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener métricas de agentes'
        });
    }
});

/**
 * Rutas para gestión de sesiones de agentes
 */

// Crear sesión de agente
router.post('/agents/:agentId/session', async (req: Request, res: Response) => {
    try {
        const { agentId } = req.params;
        const { sessionId, maxConversations } = req.body;

        if (!sessionId) {
            res.status(400).json({
                success: false,
                error: 'sessionId es requerido'
            });
            return;
        }

        const session = await enhancementService.startAgentSession(agentId, sessionId, maxConversations);

        res.status(201).json({
            success: true,
            data: session
        });
    } catch (error) {
        console.error('Error creating agent session:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear sesión de agente'
        });
    }
});

// Finalizar sesión de agente
router.delete('/agents/:agentId/session', async (req: Request, res: Response) => {
    try {
        const { agentId } = req.params;

        const success = await enhancementService.endAgentSession(agentId);

        if (!success) {
            res.status(404).json({
                success: false,
                error: 'Sesión de agente no encontrada'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Sesión finalizada exitosamente'
        });
    } catch (error) {
        console.error('Error ending agent session:', error);
        res.status(500).json({
            success: false,
            error: 'Error al finalizar sesión de agente'
        });
    }
});

// Obtener sesiones activas de agentes
router.get('/agents/sessions/active', async (req: Request, res: Response) => {
    try {
        // Por ahora devolvemos un array vacío ya que el método no está implementado
        // TODO: Implementar getActiveSessions en el servicio o acceder a las sesiones activas
        const activeSessions: any[] = [];

        res.json({
            success: true,
            data: activeSessions,
            message: 'Método pendiente de implementación'
        });
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener sesiones activas'
        });
    }
});

// Generar respuestas sugeridas para agentes
router.post('/ai/suggested-responses', healthMonitor.aiHealthCheck, async (req: Request, res: Response) => {
    try {
        const { conversationId, messages, customerInfo } = req.body;

        // Validaciones mejoradas
        if (!conversationId) {
            res.status(400).json({
                success: false,
                error: 'El ID de la conversación es requerido'
            });
            return;
        }

        if (!Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Se requiere al menos un mensaje para generar sugerencias'
            });
            return;
        }

        // Validar estructura de mensajes
        const invalidMessage = messages.find(msg =>
            !msg.content || typeof msg.content !== 'string' || msg.content.trim().length === 0
        );

        if (invalidMessage) {
            res.status(400).json({
                success: false,
                error: 'Los mensajes deben tener contenido válido'
            });
            return;
        }

        console.log(`🤖 Generando sugerencias para conversación ${conversationId} con ${messages.length} mensajes`);

        // Usar el servicio de Azure OpenAI para generar respuestas sugeridas
        const { AzureOpenAIService } = await import('../services/AzureOpenAIService');
        const aiService = new AzureOpenAIService(); const startTime = Date.now();
        const aiResponse = await aiService.generateSuggestedResponses(messages, customerInfo);
        const processingTime = Date.now() - startTime;

        if (!aiResponse.success) {
            console.error('Error en AI Service:', aiResponse.error);

            // Proporcionar respuestas de respaldo cuando falle la IA
            const fallbackSuggestions = {
                analysis: "No se pudo generar análisis automático. Revisa el último mensaje del cliente y proporciona una respuesta apropiada.",
                suggestions: [
                    {
                        type: "professional",
                        text: "Gracias por contactarnos. Revisaré tu consulta y te proporcionaré una respuesta completa."
                    },
                    {
                        type: "empathetic",
                        text: "Entiendo tu situación. Permíteme verificar la información y ayudarte con una solución."
                    },
                    {
                        type: "proactive",
                        text: "Mientras reviso tu caso, ¿hay algún detalle adicional que puedas compartir?"
                    }
                ]
            };

            res.json({
                success: true,
                data: {
                    conversationId,
                    analysis: fallbackSuggestions.analysis,
                    suggestions: fallbackSuggestions.suggestions,
                    generatedAt: new Date().toISOString(),
                    model: 'fallback',
                    processingTimeMs: processingTime,
                    messageCount: messages.length,
                    isFailover: true,
                    aiError: aiResponse.error,
                    retryCount: aiResponse.retryCount || 0
                }
            });
            return;
        }

        // Parsear y validar la respuesta JSON de la IA
        let suggestedResponses;
        try {
            suggestedResponses = JSON.parse(aiResponse.message);

            // Validar estructura de la respuesta
            if (!suggestedResponses.analysis || !Array.isArray(suggestedResponses.suggestions)) {
                throw new Error('Estructura de respuesta inválida');
            }

            if (suggestedResponses.suggestions.length !== 3) {
                throw new Error('Se esperan exactamente 3 sugerencias');
            }

            // Validar cada sugerencia
            for (const suggestion of suggestedResponses.suggestions) {
                if (!suggestion.type || !suggestion.text) {
                    throw new Error('Cada sugerencia debe tener tipo y texto');
                }
                if (!['professional', 'empathetic', 'proactive'].includes(suggestion.type)) {
                    throw new Error('Tipo de sugerencia inválido');
                }
            }

        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            console.error('Raw AI response:', aiResponse.message);
            res.status(500).json({
                success: false,
                error: 'Error al procesar respuesta de IA. La respuesta no tiene el formato esperado.'
            });
            return;
        } console.log(`✅ Sugerencias generadas exitosamente en ${processingTime}ms`);

        res.json({
            success: true,
            data: {
                conversationId,
                analysis: suggestedResponses.analysis,
                suggestions: suggestedResponses.suggestions,
                generatedAt: new Date().toISOString(),
                model: aiResponse.modelUsed,
                processingTimeMs: processingTime,
                messageCount: messages.length,
                retryCount: aiResponse.retryCount || 0
            }
        });

    } catch (error) {
        console.error('Error generating suggested responses:', error);

        // Determinar tipo de error para mejor respuesta
        let statusCode = 500;
        let errorMessage = 'Error interno del servidor';

        if (error instanceof Error) {
            if (error.message.includes('credentials') || error.message.includes('authentication')) {
                statusCode = 503;
                errorMessage = 'Servicio de IA temporalmente no disponible';
            } else if (error.message.includes('timeout') || error.message.includes('network')) {
                statusCode = 504;
                errorMessage = 'Tiempo de espera agotado. Por favor, inténtalo nuevamente';
            } else {
                errorMessage = 'Error al procesar la solicitud';
            }
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

export default router;

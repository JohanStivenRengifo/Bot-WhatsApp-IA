import { Request, Response } from 'express';
import { config } from '../config';
import { MessageHandler } from './MessageHandler';
import { SecurityService, MessageService, AzureOpenAIService } from '../services';
import { AgentHandoverFlow } from '../flows/AgentHandoverFlow';
import { WhatsAppHandoverEvent } from '../interfaces/WhatsAppMessage';
import { HealthMonitorMiddleware } from '../middleware/healthMonitor';

export class WebhookController {
    private messageHandler: MessageHandler;
    private azureOpenAIService: AzureOpenAIService;
    private securityService: SecurityService;
    private messageService: MessageService;
    private healthMonitor: HealthMonitorMiddleware;

    constructor() {
        this.messageHandler = MessageHandler.getInstance();
        this.azureOpenAIService = new AzureOpenAIService();
        this.securityService = new SecurityService();
        this.messageService = MessageService.getInstance();
        this.healthMonitor = HealthMonitorMiddleware.getInstance();
    }

    async verifyWebhook(req: Request, res: Response): Promise<void> {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            console.log('Webhook verification attempt:', {
                mode,
                token,
                challenge,
                expectedToken: config.meta.webhookVerifyToken
            });

            if (!mode || !token) {
                console.error('Missing mode or token in webhook verification');
                res.status(400).send('Missing parameters');
                return;
            }

            if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
                console.log('Webhook verified successfully');
                res.status(200).send(challenge);
            } else {
                console.error('Invalid verification token');
                res.status(403).send('Invalid verify token');
            }
        } catch (error) {
            console.error('Error in webhook verification:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            const body = req.body as {
                object: string;
                entry?: Array<{
                    changes?: Array<{
                        field: string;
                        value: {
                            messages?: Array<Record<string, unknown>>;
                            messaging_handovers?: Array<Record<string, unknown>>;
                            [key: string]: unknown;
                        };
                    }>;
                }>;
            };

            if (body.object === 'whatsapp_business_account') {
                body.entry?.forEach((entry) => {
                    entry.changes?.forEach((change) => {                        // Manejar mensajes estándar
                        if (change.field === 'messages') {
                            const messages = change.value.messages;
                            const statuses = change.value.statuses;

                            // Procesar solo mensajes entrantes del cliente (no confirmaciones de entrega)
                            if (messages) {
                                messages.forEach((message) => {
                                    // FILTRO CRÍTICO: Solo procesar mensajes entrantes del cliente
                                    // Verificar que el mensaje sea del cliente y no una confirmación de entrega
                                    if (this.isIncomingCustomerMessage(message)) {
                                        console.log(`📩 Procesando mensaje entrante del cliente: ${message.from}`);

                                        // Validar y transformar el mensaje antes de procesarlo
                                        const whatsappMessage = this.transformMessage(message);

                                        if (whatsappMessage) {
                                            this.messageHandler.processMessage(whatsappMessage);
                                        }
                                    } else {
                                        console.log(`🚫 Mensaje filtrado (no es del cliente): ${JSON.stringify(message)}`);
                                    }
                                });
                            }
                            // Procesar confirmaciones de entrega separadamente (sin enviar al MessageHandler)
                            if (statuses && Array.isArray(statuses)) {
                                (statuses as Array<Record<string, unknown>>).forEach((status) => {
                                    console.log(`✅ Confirmación de entrega recibida: ${JSON.stringify(status)}`);
                                    // Aquí podríamos actualizar el estado del mensaje en el CRM si es necesario
                                });
                            }
                        }

                        // Manejar eventos de handover (transferencia a agentes humanos)
                        if (change.field === 'messaging_handovers') {
                            const handovers = change.value.messaging_handovers;
                            if (handovers) {
                                handovers.forEach((handover) => {
                                    this.handleHandoverEvent(handover);
                                });
                            }
                        }
                    });
                });
            }

            res.status(200).send('EVENT_RECEIVED');
        } catch (error) {
            console.error('Error handling webhook:', error);
            res.status(500).send('Internal Server Error');
        }
    } async healthCheck(req: Request, res: Response): Promise<void> {
        try {
            const aiStatus = await this.azureOpenAIService.getServiceStatus();
            const aiConfig = this.azureOpenAIService.getCurrentConfiguration();
            const securityStats = this.securityService.getSecurityStats();
            const healthMonitorStatus = this.healthMonitor.getHealthStatus();

            const overallHealthy = aiStatus.status === 'active' && healthMonitorStatus.azureOpenAI.isHealthy;

            res.status(overallHealthy ? 200 : 503).json({
                status: overallHealthy ? 'active' : 'degraded',
                service: 'Conecta2 WhatsApp Bot',
                timestamp: new Date().toISOString(),
                ai: {
                    configuration: aiConfig,
                    services: aiStatus,
                    monitoring: healthMonitorStatus.azureOpenAI
                },
                security: {
                    blockedUsers: securityStats.blockedUsers,
                    activeSessions: securityStats.activeSessions,
                    rateLimitedUsers: securityStats.rateLimitedUsers,
                    totalAuthAttempts: securityStats.totalAuthAttempts
                },
                monitoring: healthMonitorStatus.monitoring
            });
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                status: 'error',
                service: 'Conecta2 WhatsApp Bot',
                timestamp: new Date().toISOString(),
                error: 'Failed to check services status'
            });
        }
    } private transformMessage(message: Record<string, unknown>): import('../interfaces').WhatsAppMessage | null {
        try {
            // Validar campos requeridos
            if (
                typeof message.from !== 'string' ||
                typeof message.id !== 'string' ||
                typeof message.timestamp !== 'string' ||
                typeof message.type !== 'string'
            ) {
                console.error('Missing required fields in WhatsApp message');
                return null;
            }

            // Validar el tipo de mensaje
            const validTypes = ['text', 'interactive', 'image', 'document', 'audio', 'video', 'location'];
            if (!validTypes.includes(message.type as string)) {
                console.error('Invalid message type');
                return null;
            }

            // Crear el mensaje tipado
            const whatsappMessage: import('../interfaces').WhatsAppMessage = {
                from: message.from as string,
                id: message.id as string,
                timestamp: message.timestamp as string,
                type: message.type as import('../interfaces').WhatsAppMessage['type'],
            };

            // Agregar campos opcionales según el tipo
            if (message.type === 'text' && message.text && typeof (message.text as { body: string }).body === 'string') {
                whatsappMessage.text = { body: (message.text as { body: string }).body };
            }

            if (message.type === 'interactive' && message.interactive) {
                whatsappMessage.interactive = message.interactive as typeof whatsappMessage.interactive;
            }

            // ... agregar otros tipos según sea necesario

            return whatsappMessage;
        } catch (error) {
            console.error('Error transforming WhatsApp message:', error);
            return null;
        }
    }    /**
     * Maneja eventos de handover (transferencia) entre el bot y agentes humanos
     * @param handover El evento de handover recibido
     */
    private async handleHandoverEvent(handover: Record<string, unknown>): Promise<void> {
        try {
            // Validar campos requeridos
            if (
                !handover.messaging_product ||
                !handover.sender ||
                !handover.timestamp ||
                !handover.control_passed
            ) {
                console.error('Missing required fields in handover event', handover);
                return;
            }

            // Obtener el número de teléfono del remitente
            const sender = handover.sender as { phone_number: string };
            if (!sender.phone_number) {
                console.error('Missing sender phone number in handover event', handover);
                return;
            }

            // Obtener los metadatos si existen
            const controlPassed = handover.control_passed as { metadata?: string };
            const metadata = controlPassed.metadata || '';

            console.log(`[HandoverEvent] Recibido evento de handover para ${sender.phone_number}`);
            console.log(`[HandoverEvent] Timestamp: ${handover.timestamp}`);
            console.log(`[HandoverEvent] Metadata: ${metadata}`);

            // Convertir el objeto handover a la interfaz tipada WhatsAppHandoverEvent
            const handoverEvent: import('../interfaces').WhatsAppHandoverEvent = {
                messaging_product: handover.messaging_product as string,
                recipient: {
                    display_phone_number: (handover.recipient as any)?.display_phone_number || '',
                    phone_number_id: (handover.recipient as any)?.phone_number_id || ''
                },
                sender: {
                    phone_number: sender.phone_number
                },
                timestamp: handover.timestamp as string,
                control_passed: {
                    metadata: metadata
                }
            };            // Utilizar el método estático de AgentHandoverFlow para procesar el evento
            const messageService = MessageService.getInstance();
            await AgentHandoverFlow.processHandoverEvent(handoverEvent, messageService);

        } catch (error) {
            console.error('Error handling handover event:', error);
        }
    }

    /**
     * Verifica si un mensaje es realmente del cliente y no una confirmación de entrega
     */
    private isIncomingCustomerMessage(message: Record<string, unknown>): boolean {
        // Verificar que tenga los campos básicos de un mensaje del cliente
        if (!message.from || !message.id || !message.timestamp || !message.type) {
            return false;
        }

        // Filtrar mensajes de confirmación de entrega o estado
        // Los mensajes de estado no tienen contenido de texto o interacción
        const messageType = message.type as string;

        // Solo procesar tipos de mensajes válidos del cliente
        const validCustomerMessageTypes = ['text', 'interactive', 'image', 'document', 'audio', 'video', 'location'];
        if (!validCustomerMessageTypes.includes(messageType)) {
            console.log(`🚫 Tipo de mensaje filtrado: ${messageType}`);
            return false;
        }

        // Verificar que tenga contenido real (no sea solo un mensaje de estado)
        if (messageType === 'text') {
            const textContent = message.text as { body?: string };
            if (!textContent || !textContent.body || textContent.body.trim() === '') {
                console.log(`🚫 Mensaje de texto vacío filtrado`);
                return false;
            }
        }

        // Filtrar mensajes que son claramente confirmaciones del sistema
        // (estos suelen tener IDs específicos o patrones reconocibles)
        const messageId = message.id as string;
        if (messageId && messageId.startsWith('wamid.')) {
            // Los mensajes del cliente tienen IDs que empiezan con 'wamid.'
            // pero las confirmaciones de entrega también pueden tenerlos
            // Necesitamos verificar más campos para estar seguros

            // Si el mensaje tiene un campo 'context' apuntando a un mensaje anterior,
            // probablemente es una respuesta del cliente
            if (message.context) {
                return true;
            }

            // Si tiene contenido válido y un 'from' que no es nuestro número, es del cliente
            const from = message.from as string;
            const ourPhoneNumberId = process.env.PHONE_NUMBER_ID || '';

            if (from && from !== ourPhoneNumberId && messageType === 'text') {
                return true;
            }

            if (from && from !== ourPhoneNumberId && messageType === 'interactive') {
                return true;
            }
        }

        // Por defecto, si llega hasta aquí y tiene los campos básicos, es probablemente del cliente
        return true;
    }
}
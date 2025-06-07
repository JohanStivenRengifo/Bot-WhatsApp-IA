import { Request, Response } from 'express';
import { config } from '../config';
import { MessageHandler } from './MessageHandler';
import { AIService, SecurityService, MessageService } from '../services';
import { AgentHandoverFlow } from '../flows/AgentHandoverFlow';
import { WhatsAppHandoverEvent } from '../interfaces/WhatsAppMessage';

export class WebhookController {
    private messageHandler: MessageHandler;
    private aiService: AIService;
    private securityService: SecurityService;
    private messageService: MessageService;

    constructor() {
        this.messageHandler = new MessageHandler();
        this.aiService = new AIService();
        this.securityService = new SecurityService();
        this.messageService = new MessageService();
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
    } async handleWebhook(req: Request, res: Response): Promise<void> {
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
                    entry.changes?.forEach((change) => {
                        // Manejar mensajes estándar
                        if (change.field === 'messages') {
                            const messages = change.value.messages;
                            if (messages) {
                                messages.forEach((message) => {
                                    // Validar y transformar el mensaje antes de procesarlo
                                    const whatsappMessage = this.transformMessage(message);

                                    if (whatsappMessage) {
                                        this.messageHandler.processMessage(whatsappMessage);
                                    }
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
    }

    async healthCheck(req: Request, res: Response): Promise<void> {
        try {
            const aiStatus = await this.aiService.getServiceStatus();
            const aiConfig = this.aiService.getCurrentConfiguration();
            const securityStats = this.securityService.getSecurityStats();

            res.json({
                status: 'active',
                service: 'Conecta2 WhatsApp Bot',
                timestamp: new Date().toISOString(),
                ai: {
                    configuration: aiConfig,
                    services: aiStatus
                },
                security: {
                    blockedUsers: securityStats.blockedUsers,
                    activeSessions: securityStats.activeSessions,
                    rateLimitedUsers: securityStats.rateLimitedUsers,
                    totalAuthAttempts: securityStats.totalAuthAttempts
                }
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
            };

            // Utilizar el método estático de AgentHandoverFlow para procesar el evento
            const messageService = new MessageService();
            await AgentHandoverFlow.processHandoverEvent(handoverEvent, messageService);

        } catch (error) {
            console.error('Error handling handover event:', error);
        }
    }
}
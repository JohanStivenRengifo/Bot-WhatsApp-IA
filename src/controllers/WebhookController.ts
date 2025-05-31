import { Request, Response } from 'express';
import { config } from '../config';
import { MessageHandler } from './MessageHandler';
import { AIService, SecurityService } from '../services';

export class WebhookController {
    private messageHandler: MessageHandler;
    private aiService: AIService;
    private securityService: SecurityService;

    constructor() {
        this.messageHandler = new MessageHandler();
        this.aiService = new AIService();
        this.securityService = new SecurityService();
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
                            [key: string]: unknown;
                        };
                    }>;
                }>;
            };

            if (body.object === 'whatsapp_business_account') {
                body.entry?.forEach((entry) => {
                    entry.changes?.forEach((change) => {
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
    }

    private transformMessage(message: Record<string, unknown>): import('../interfaces').WhatsAppMessage | null {
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
    }
}
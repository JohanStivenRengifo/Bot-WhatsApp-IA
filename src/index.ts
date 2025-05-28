import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import ping from 'ping';
import moment from 'moment';
import dotenv from 'dotenv';
dotenv.config();


// Interfaces
interface User {
    phoneNumber: string;
    authenticated: boolean;
    acceptedPrivacyPolicy: boolean;
    customerId?: string;
    sessionData?: any;
}

interface Ticket {
    id: string;
    customerId: string;
    subject: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    createdAt: Date;
}

interface Invoice {
    id: string;
    customerId: string;
    amount: number;
    dueDate: Date;
    status: 'pending' | 'paid' | 'overdue';
    pdfUrl?: string;
}

// Configuration
const config = {
    meta: {
        accessToken: process.env.META_ACCESS_TOKEN || '',
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
        phoneNumberId: process.env.PHONE_NUMBER_ID || '',
        version: 'v18.0'
    },
    wisphub: {
        baseUrl: process.env.WISPHUB_API_URL || '',
        apiKey: process.env.WISPHUB_API_KEY || ''
    },
    crm: {
        baseUrl: process.env.CRM_API_URL || '',
        apiKey: process.env.CRM_API_KEY || ''
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || ''
    }
};

class WhatsAppBot {
    private app: express.Application;
    private users: Map<string, User> = new Map();
    private userSessions: Map<string, any> = new Map();

    constructor() {
        this.app = express();
        this.app.use(express.json());
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Webhook verification
        this.app.get('/webhook', this.verifyWebhook.bind(this));

        // Webhook handler
        this.app.post('/webhook', this.handleWebhook.bind(this));

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'active', service: 'Conecta2 WhatsApp Bot' });
        });
    }

    private verifyWebhook(req: express.Request, res: express.Response): void {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
            console.log('Webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            res.status(403).send('Forbidden');
        }
    }

    private async handleWebhook(req: express.Request, res: express.Response): Promise<void> {
        try {
            const body = req.body;

            if (body.object === 'whatsapp_business_account') {
                body.entry?.forEach((entry: any) => {
                    entry.changes?.forEach((change: any) => {
                        if (change.field === 'messages') {
                            const messages = change.value.messages;
                            if (messages) {
                                messages.forEach((message: any) => {
                                    this.processMessage(message, change.value);
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

    private async processMessage(message: any, value: any): Promise<void> {
        const phoneNumber = message.from;
        const messageType = message.type;
        let messageText = '';

        // Extract message text based on type
        switch (messageType) {
            case 'text':
                messageText = message.text.body;
                break;
            case 'interactive':
                messageText = message.interactive.button_reply?.id ||
                    message.interactive.list_reply?.id || '';
                break;
            default:
                messageText = 'unsupported_message_type';
        }

        // Get or create user
        let user = this.users.get(phoneNumber);
        if (!user) {
            user = {
                phoneNumber,
                authenticated: false,
                acceptedPrivacyPolicy: false
            };
            this.users.set(phoneNumber, user);
        }

        // Process message based on user state
        await this.handleUserMessage(user, messageText, messageType);
    }

    private async handleUserMessage(user: User, message: string, messageType: string): Promise<void> {
        try {
            // Privacy policy acceptance flow
            if (!user.acceptedPrivacyPolicy) {
                await this.handlePrivacyPolicyFlow(user, message);
                return;
            }

            // Authentication flow
            if (!user.authenticated) {
                await this.handleAuthenticationFlow(user, message);
                return;
            }

            // Main menu and commands
            await this.handleMainCommands(user, message);
        } catch (error) {
            console.error('Error handling user message:', error);
            await this.sendTextMessage(user.phoneNumber,
                'Ha ocurrido un error técnico. Por favor, intenta nuevamente en unos minutos.');
        }
    }

    private async handlePrivacyPolicyFlow(user: User, message: string): Promise<void> {
        if (message.toLowerCase().includes('acepto') || message === 'accept_privacy') {
            user.acceptedPrivacyPolicy = true;
            this.users.set(user.phoneNumber, user);

            await this.sendTextMessage(user.phoneNumber,
                '✅ Gracias por aceptar nuestras políticas.\n\n' +
                'Ahora necesito autenticarte para brindarte soporte personalizado.\n\n' +
                'Por favor, ingresa tu número de documento de identidad:');
        } else {
            await this.sendPrivacyPolicyMessage(user.phoneNumber);
        }
    }

    private async sendPrivacyPolicyMessage(phoneNumber: string): Promise<void> {
        const privacyMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '🛡️ Conecta2 Telecomunicaciones'
                },
                body: {
                    text: 'Bienvenido a Conecta2 Telecomunicaciones SAS.\n\n' +
                        'Para brindarte el mejor servicio, necesitamos tu autorización para el ' +
                        'tratamiento de tus datos personales según nuestra política de privacidad.\n\n' +
                        '📋 Tus datos serán utilizados únicamente para:\n' +
                        '• Gestión de tu cuenta y servicios\n' +
                        '• Soporte técnico personalizado\n' +
                        '• Facturación y pagos\n' +
                        '• Comunicaciones importantes\n\n' +
                        '¿Autorizas el tratamiento de tus datos personales?'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'accept_privacy',
                                title: 'Acepto'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'reject_privacy',
                                title: 'No acepto'
                            }
                        }
                    ]
                }
            }
        };

        await this.sendMessage(privacyMessage);
    }

    private async handleAuthenticationFlow(user: User, message: string): Promise<void> {
        try {
            // Authenticate user with WispHub
            const customerData = await this.authenticateCustomer(message);

            if (customerData) {
                user.authenticated = true;
                user.customerId = customerData.id;
                this.users.set(user.phoneNumber, user);

                await this.sendTextMessage(user.phoneNumber,
                    `✅ ¡Hola ${customerData.name}!\n\n` +
                    'Autenticación exitosa. Ahora puedes acceder a todos nuestros servicios.\n\n' +
                    'Escribe "menu" para ver las opciones disponibles.');
            } else {
                await this.sendTextMessage(user.phoneNumber,
                    '❌ No pude encontrar tu información.\n\n' +
                    'Verifica tu número de documento e intenta nuevamente, o escribe "ayuda" para contactar a un agente.');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            await this.sendTextMessage(user.phoneNumber,
                'Error en la autenticación. Intenta nuevamente.');
        }
    }

    private async handleMainCommands(user: User, message: string): Promise<void> {
        const command = message.toLowerCase().trim();

        switch (command) {
            case 'menu':
            case 'inicio':
                await this.sendMainMenu(user.phoneNumber);
                break;

            case 'ping':
            case 'test_conexion':
                await this.handlePingRequest(user);
                break;

            case 'factura':
            case 'invoice':
                await this.handleInvoiceRequest(user);
                break;

            case 'deuda':
            case 'saldo':
                await this.handleDebtInquiry(user);
                break;

            case 'cambiar_clave':
            case 'password':
                await this.handlePasswordChange(user);
                break;

            case 'ticket':
            case 'soporte':
                await this.handleTicketCreation(user);
                break;

            case 'mejorar_plan':
            case 'upgrade':
                await this.handlePlanUpgrade(user);
                break;

            case 'puntos_pago':
            case 'payment_points':
                await this.handlePaymentPoints(user);
                break;

            default:
                // AI-powered response for unrecognized commands
                await this.handleIntelligentResponse(user, message);
                break;
        }
    }

    private async sendMainMenu(phoneNumber: string): Promise<void> {
        const menuMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: '🌐 Conecta2 - Menú Principal'
                },
                body: {
                    text: 'Selecciona la opción que necesitas:'
                },
                action: {
                    button: 'Ver opciones',
                    sections: [
                        {
                            title: 'Servicios Técnicos',
                            rows: [
                                {
                                    id: 'ping',
                                    title: '📡 Test de Conexión',
                                    description: 'Verificar estado de tu conexión'
                                },
                                {
                                    id: 'ticket',
                                    title: '🎫 Crear Ticket',
                                    description: 'Reportar problemas técnicos'
                                }
                            ]
                        },
                        {
                            title: 'Facturación',
                            rows: [
                                {
                                    id: 'factura',
                                    title: '📄 Mi Factura',
                                    description: 'Consultar y descargar facturas'
                                },
                                {
                                    id: 'deuda',
                                    title: '💰 Consultar Deuda',
                                    description: 'Ver saldo pendiente'
                                },
                                {
                                    id: 'puntos_pago',
                                    title: '📍 Puntos de Pago',
                                    description: 'Ubicaciones para pagar'
                                }
                            ]
                        },
                        {
                            title: 'Cuenta',
                            rows: [
                                {
                                    id: 'cambiar_clave',
                                    title: '🔐 Cambiar Contraseña',
                                    description: 'Actualizar clave de acceso'
                                },
                                {
                                    id: 'mejorar_plan',
                                    title: '⬆️ Mejorar Plan',
                                    description: 'Upgrade de velocidad'
                                }
                            ]
                        }
                    ]
                }
            }
        };

        await this.sendMessage(menuMessage);
    }

    private async handlePingRequest(user: User): Promise<void> {
        try {
            await this.sendTextMessage(user.phoneNumber,
                '📡 Verificando tu conexión...\n\nEsto puede tomar unos segundos.');

            const customerInfo = await this.getCustomerInfo(user.customerId!);
            const ipAddress = customerInfo.ip_address;

            if (!ipAddress) {
                throw new Error('IP address not found');
            }

            const pingResult = await this.pingIP(ipAddress);

            let statusMessage = '';
            if (pingResult.alive) {
                statusMessage = `✅ *Conexión ACTIVA*\n\n` +
                    `🌐 IP: ${ipAddress}\n` +
                    `⏱️ Tiempo: ${pingResult.time}ms\n` +
                    `📊 Estado: Óptimo`;
            } else {
                statusMessage = `❌ *Conexión INACTIVA*\n\n` +
                    `🌐 IP: ${ipAddress}\n` +
                    `⚠️ Tu equipo no responde al ping\n\n` +
                    `💡 *Posibles soluciones:*\n` +
                    `• Reinicia tu router\n` +
                    `• Verifica cables de conexión\n` +
                    `• Contacta soporte si persiste`;

                // Auto-create ticket for connection issues
                await this.createAutoTicket(user, 'Conexión inactiva',
                    `Ping fallido a IP ${ipAddress}`);
            }

            await this.sendTextMessage(user.phoneNumber, statusMessage);
        } catch (error) {
            console.error('Ping error:', error);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al verificar conexión. Intenta nuevamente o contacta soporte.');
        }
    }

    private async handleInvoiceRequest(user: User): Promise<void> {
        try {
            const invoices = await this.getCustomerInvoices(user.customerId!);

            if (invoices.length === 0) {
                await this.sendTextMessage(user.phoneNumber,
                    '📄 No tienes facturas pendientes en este momento.');
                return;
            }

            const latestInvoice = invoices[0];
            const statusEmoji = latestInvoice.status === 'paid' ? '✅' :
                latestInvoice.status === 'overdue' ? '🚨' : '⏳';

            const invoiceMessage = `📄 *Tu Factura Actual*\n\n` +
                `${statusEmoji} Estado: ${this.getInvoiceStatusText(latestInvoice.status)}\n` +
                `💰 Valor: $${latestInvoice.amount.toLocaleString()}\n` +
                `📅 Vencimiento: ${moment(latestInvoice.dueDate).format('DD/MM/YYYY')}\n\n`;

            await this.sendTextMessage(user.phoneNumber, invoiceMessage);

            // Send PDF if available
            if (latestInvoice.pdfUrl) {
                await this.sendDocument(user.phoneNumber, latestInvoice.pdfUrl, 'Factura_Conecta2.pdf');
            }

            // Send payment options if pending
            if (latestInvoice.status !== 'paid') {
                await this.sendPaymentOptions(user.phoneNumber);
            }
        } catch (error) {
            console.error('Invoice error:', error);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar facturas. Intenta nuevamente.');
        }
    }

    private async handleDebtInquiry(user: User): Promise<void> {
        try {
            const debtInfo = await this.getCustomerDebt(user.customerId!);

            let debtMessage = '';
            if (debtInfo.totalDebt === 0) {
                debtMessage = '✅ *¡Felicitaciones!*\n\n' +
                    '🎉 No tienes deudas pendientes\n' +
                    '📊 Tu cuenta está al día';
            } else {
                debtMessage = `💰 *Resumen de Deuda*\n\n` +
                    `🔴 Total adeudado: $${debtInfo.totalDebt.toLocaleString()}\n` +
                    `📄 Facturas pendientes: ${debtInfo.pendingInvoices}\n` +
                    `📅 Próxima fecha límite: ${moment(debtInfo.nextDueDate).format('DD/MM/YYYY')}\n\n` +
                    `💡 Paga antes del vencimiento para evitar suspensión del servicio.`;
            }

            await this.sendTextMessage(user.phoneNumber, debtMessage);

            if (debtInfo.totalDebt > 0) {
                await this.sendPaymentOptions(user.phoneNumber);
            }
        } catch (error) {
            console.error('Debt inquiry error:', error);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar deuda. Intenta nuevamente.');
        }
    }

    private async handlePasswordChange(user: User): Promise<void> {
        const session = this.userSessions.get(user.phoneNumber) || {};

        if (!session.changingPassword) {
            session.changingPassword = true;
            session.step = 'current_password';
            this.userSessions.set(user.phoneNumber, session);

            await this.sendTextMessage(user.phoneNumber,
                '🔐 *Cambio de Contraseña*\n\n' +
                'Para tu seguridad, necesito verificar tu identidad.\n\n' +
                'Ingresa tu contraseña actual:');
        }
        // Password change flow continues in intelligent response handler
    }

    private async handleTicketCreation(user: User): Promise<void> {
        const session = this.userSessions.get(user.phoneNumber) || {};

        if (!session.creatingTicket) {
            session.creatingTicket = true;
            session.step = 'category';
            this.userSessions.set(user.phoneNumber, session);

            const ticketMenu = {
                messaging_product: 'whatsapp',
                to: user.phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: {
                        type: 'text',
                        text: '🎫 Crear Ticket de Soporte'
                    },
                    body: {
                        text: 'Selecciona el tipo de problema:'
                    },
                    action: {
                        button: 'Seleccionar',
                        sections: [
                            {
                                title: 'Problemas Técnicos',
                                rows: [
                                    {
                                        id: 'internet_lento',
                                        title: '🐌 Internet Lento',
                                        description: 'Velocidad menor a la contratada'
                                    },
                                    {
                                        id: 'sin_internet',
                                        title: '🚫 Sin Internet',
                                        description: 'No hay conexión a internet'
                                    },
                                    {
                                        id: 'intermitente',
                                        title: '📶 Conexión Intermitente',
                                        description: 'Se corta constantemente'
                                    }
                                ]
                            },
                            {
                                title: 'Otros',
                                rows: [
                                    {
                                        id: 'facturacion',
                                        title: '💰 Facturación',
                                        description: 'Problemas con cobros'
                                    },
                                    {
                                        id: 'otro',
                                        title: '❓ Otro',
                                        description: 'Problema diferente'
                                    }
                                ]
                            }
                        ]
                    }
                }
            };

            await this.sendMessage(ticketMenu);
        }
    }

    private async handlePlanUpgrade(user: User): Promise<void> {
        try {
            const currentPlan = await this.getCustomerPlan(user.customerId!);
            const availableUpgrades = await this.getAvailableUpgrades(user.customerId!);

            if (availableUpgrades.length === 0) {
                await this.sendTextMessage(user.phoneNumber,
                    '⬆️ Ya tienes nuestro plan más avanzado.\n\n' +
                    '🎉 ¡Gracias por confiar en nosotros!');
                return;
            }

            let upgradeMessage = `⬆️ *Mejora tu Plan*\n\n` +
                `📊 Plan actual: ${currentPlan.name}\n` +
                `🚀 Velocidad: ${currentPlan.speed}\n` +
                `💰 Valor: $${currentPlan.price.toLocaleString()}\n\n` +
                `*Planes disponibles para upgrade:*\n\n`;

            availableUpgrades.forEach((plan: any, index: number) => {
                upgradeMessage += `${index + 1}. ${plan.name}\n` +
                    `   🚀 Velocidad: ${plan.speed}\n` +
                    `   💰 Valor: $${plan.price.toLocaleString()}\n\n`;
            });

            upgradeMessage += 'Responde con el número del plan que te interesa o escribe "agente" para hablar con nuestro equipo comercial.';

            await this.sendTextMessage(user.phoneNumber, upgradeMessage);
        } catch (error) {
            console.error('Plan upgrade error:', error);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar planes. Contacta a nuestro equipo comercial.');
        }
    }

    private async handlePaymentPoints(user: User): Promise<void> {
        try {
            const paymentPoints = await this.getPaymentPoints();

            let pointsMessage = '📍 *Puntos de Pago Autorizados*\n\n';

            paymentPoints.forEach((point: any, index: number) => {
                pointsMessage += `${index + 1}. **${point.name}**\n` +
                    `   📍 ${point.address}\n` +
                    `   ⏰ ${point.hours}\n` +
                    `   📞 ${point.phone}\n\n`;
            });

            pointsMessage += '💡 También puedes pagar en línea a través de nuestro portal web o bancos en línea.';

            await this.sendTextMessage(user.phoneNumber, pointsMessage);

            // Send location for the nearest point
            if (paymentPoints.length > 0) {
                await this.sendLocation(user.phoneNumber,
                    paymentPoints[0].latitude,
                    paymentPoints[0].longitude,
                    paymentPoints[0].name,
                    paymentPoints[0].address);
            }
        } catch (error) {
            console.error('Payment points error:', error);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al consultar puntos de pago. Intenta nuevamente.');
        }
    }

    private async handleIntelligentResponse(user: User, message: string): Promise<void> {
        try {
            // Check for ongoing sessions first
            const session = this.userSessions.get(user.phoneNumber);

            if (session?.changingPassword) {
                await this.handlePasswordChangeFlow(user, message, session);
                return;
            }

            if (session?.creatingTicket) {
                await this.handleTicketFlow(user, message, session);
                return;
            }

            // AI-powered response for general queries
            const aiResponse = await this.getAIResponse(message, user);
            await this.sendTextMessage(user.phoneNumber, aiResponse);

        } catch (error) {
            console.error('Intelligent response error:', error);
            await this.sendTextMessage(user.phoneNumber,
                'No entendí tu solicitud. Escribe "menu" para ver las opciones disponibles o "agente" para hablar con una persona.');
        }
    }

    // Utility Methods
    private async sendMessage(message: any): Promise<void> {
        try {
            await axios.post(
                `https://graph.facebook.com/${config.meta.version}/${config.meta.phoneNumberId}/messages`,
                message,
                {
                    headers: {
                        'Authorization': `Bearer ${config.meta.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    private async sendTextMessage(phoneNumber: string, text: string): Promise<void> {
        const message = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: text }
        };

        await this.sendMessage(message);
    }

    private async sendDocument(phoneNumber: string, documentUrl: string, filename: string): Promise<void> {
        const message = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'document',
            document: {
                link: documentUrl,
                filename: filename
            }
        };

        await this.sendMessage(message);
    }

    private async sendLocation(phoneNumber: string, latitude: number, longitude: number, name: string, address: string): Promise<void> {
        const message = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'location',
            location: {
                latitude: latitude,
                longitude: longitude,
                name: name,
                address: address
            }
        };

        await this.sendMessage(message);
    }

    // Integration Methods
    private async authenticateCustomer(documentNumber: string): Promise<any> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/search`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` },
                params: { document: documentNumber }
            });

            return response.data;
        } catch (error) {
            console.error('Customer authentication error:', error);
            return null;
        }
    }

    private async getCustomerInfo(customerId: string): Promise<any> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/${customerId}`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get customer info error:', error);
            throw error;
        }
    }

    private async pingIP(ipAddress: string): Promise<ping.PingResponse> {
        try {
            const result = await ping.promise.probe(ipAddress, {
                timeout: 10,
                extra: ['-c', '3']
            });

            return result;
        } catch (error) {
            console.error('Ping error:', error);
            return {
                host: ipAddress,
                alive: false,
            } as ping.PingResponse;
        }
    }

    private async getCustomerInvoices(customerId: string): Promise<Invoice[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/${customerId}/invoices`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get invoices error:', error);
            return [];
        }
    }

    private async getCustomerDebt(customerId: string): Promise<any> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/${customerId}/debt`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get debt error:', error);
            throw error;
        }
    }

    private async createTicket(customerId: string, subject: string, description: string): Promise<string> {
        try {
            const ticketData = {
                customer_id: customerId,
                subject: subject,
                description: description,
                priority: 'medium',
                source: 'whatsapp'
            };

            const response = await axios.post(`${config.crm.baseUrl}/tickets`, ticketData, {
                headers: { 'Authorization': `Bearer ${config.crm.apiKey}` }
            });

            return response.data.ticket_id;
        } catch (error) {
            console.error('Create ticket error:', error);
            throw error;
        }
    }

    private async createAutoTicket(user: User, subject: string, description: string): Promise<void> {
        try {
            const ticketId = await this.createTicket(user.customerId!, subject, description);
            console.log(`Auto-ticket created: ${ticketId} for user ${user.phoneNumber}`);
        } catch (error) {
            console.error('Auto-ticket creation error:', error);
        }
    }

    private async getAIResponse(message: string, user: User): Promise<string> {
        try {
            const prompt = `Eres un asistente de soporte técnico para Conecta2 Telecomunicaciones SAS, una empresa de internet en Colombia. 
      Responde de manera amigable, profesional y concisa. Si no puedes resolver algo, sugiere contactar a un agente.
      
      Cliente: ${message}
      
      Respuesta (máximo 200 caracteres):`;

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${config.openai.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content.trim();
        } catch (error) {
            console.error('AI response error:', error);
            return 'No pude procesar tu consulta. Escribe "menu" para ver las opciones o "agente" para hablar con soporte.';
        }
    }

    private async handlePasswordChangeFlow(user: User, message: string, session: any): Promise<void> {
        try {
            switch (session.step) {
                case 'current_password':
                    // Verify current password with WispHub
                    const isValidPassword = await this.verifyPassword(user.customerId!, message);

                    if (isValidPassword) {
                        session.step = 'new_password';
                        this.userSessions.set(user.phoneNumber, session);

                        await this.sendTextMessage(user.phoneNumber,
                            '✅ Contraseña actual verificada.\n\n' +
                            '🔐 Ahora ingresa tu nueva contraseña:\n\n' +
                            '📋 Requisitos:\n' +
                            '• Mínimo 8 caracteres\n' +
                            '• Al menos 1 número\n' +
                            '• Al menos 1 letra mayúscula\n' +
                            '• Al menos 1 carácter especial (!@#$%^&*)');
                    } else {
                        await this.sendTextMessage(user.phoneNumber,
                            '❌ Contraseña incorrecta. Intenta nuevamente:');
                    }
                    break;

                case 'new_password':
                    if (this.isValidPassword(message)) {
                        session.step = 'confirm_password';
                        session.newPassword = message;
                        this.userSessions.set(user.phoneNumber, session);

                        await this.sendTextMessage(user.phoneNumber,
                            '🔄 Confirma tu nueva contraseña:');
                    } else {
                        await this.sendTextMessage(user.phoneNumber,
                            '❌ La contraseña no cumple los requisitos. Intenta nuevamente:\n\n' +
                            '📋 Debe tener:\n' +
                            '• Mínimo 8 caracteres\n' +
                            '• Al menos 1 número\n' +
                            '• Al menos 1 letra mayúscula\n' +
                            '• Al menos 1 carácter especial');
                    }
                    break;

                case 'confirm_password':
                    if (message === session.newPassword) {
                        // Update password in WispHub
                        const success = await this.updatePassword(user.customerId!, session.newPassword);

                        if (success) {
                            // Clear session
                            this.userSessions.delete(user.phoneNumber);

                            await this.sendTextMessage(user.phoneNumber,
                                '✅ ¡Contraseña actualizada exitosamente!\n\n' +
                                '🔐 Tu nueva contraseña ya está activa.\n' +
                                'Úsala para acceder a tu portal web y configurar tu router.');
                        } else {
                            throw new Error('Password update failed');
                        }
                    } else {
                        await this.sendTextMessage(user.phoneNumber,
                            '❌ Las contraseñas no coinciden. Confirma nuevamente:');
                    }
                    break;
            }
        } catch (error) {
            console.error('Password change flow error:', error);
            this.userSessions.delete(user.phoneNumber);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al cambiar contraseña. Intenta nuevamente más tarde o contacta soporte.');
        }
    }

    private async handleTicketFlow(user: User, message: string, session: any): Promise<void> {
        try {
            switch (session.step) {
                case 'category':
                    session.category = message;
                    session.step = 'description';
                    this.userSessions.set(user.phoneNumber, session);

                    await this.sendTextMessage(user.phoneNumber,
                        `📝 Perfecto, seleccionaste: ${this.getCategoryName(message)}\n\n` +
                        'Ahora describe detalladamente tu problema:\n\n' +
                        '💡 Incluye:\n' +
                        '• ¿Cuándo comenzó?\n' +
                        '• ¿Con qué frecuencia ocurre?\n' +
                        '• ¿Qué intentaste hacer?\n' +
                        '• Cualquier mensaje de error');
                    break;

                case 'description':
                    session.description = message;

                    // Create ticket
                    const ticketId = await this.createTicket(
                        user.customerId!,
                        this.getCategoryName(session.category),
                        session.description
                    );

                    // Clear session
                    this.userSessions.delete(user.phoneNumber);

                    await this.sendTextMessage(user.phoneNumber,
                        `✅ *Ticket Creado Exitosamente*\n\n` +
                        `🎫 Número: #${ticketId}\n` +
                        `📋 Categoría: ${this.getCategoryName(session.category)}\n` +
                        `⏰ Tiempo estimado de respuesta: 2-4 horas\n\n` +
                        `📱 Te notificaremos por WhatsApp cuando tengamos actualizaciones.\n\n` +
                        `¿Necesitas algo más? Escribe "menu" para ver otras opciones.`);

                    // Send notification to CRM
                    await this.notifyNewTicket(ticketId, user.customerId!);
                    break;
            }
        } catch (error) {
            console.error('Ticket flow error:', error);
            this.userSessions.delete(user.phoneNumber);
            await this.sendTextMessage(user.phoneNumber,
                '❌ Error al crear ticket. Contacta directamente a soporte técnico.');
        }
    }

    private async sendPaymentOptions(phoneNumber: string): Promise<void> {
        const paymentMessage = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: '💳 Opciones de Pago'
                },
                body: {
                    text: 'Puedes pagar tu factura de las siguientes maneras:'
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'puntos_pago',
                                title: '📍 Puntos de Pago'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'pago_online',
                                title: '💻 Pago Online'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'banco',
                                title: '🏦 Bancos'
                            }
                        }
                    ]
                }
            }
        };

        await this.sendMessage(paymentMessage);
    }

    // Automated notification system
    private async startNotificationSystem(): Promise<void> {
        // Check for overdue invoices every hour
        setInterval(async () => {
            await this.checkOverdueInvoices();
        }, 60 * 60 * 1000);

        // Check for service outages every 10 minutes
        setInterval(async () => {
            await this.checkServiceOutages();
        }, 10 * 60 * 1000);

        console.log('Notification system started');
    }

    private async checkOverdueInvoices(): Promise<void> {
        try {
            const overdueCustomers = await this.getOverdueCustomers();

            for (const customer of overdueCustomers) {
                const user = Array.from(this.users.values()).find(u => u.customerId === customer.id);

                if (user && user.acceptedPrivacyPolicy) {
                    const daysOverdue = moment().diff(moment(customer.lastDueDate), 'days');

                    let notificationMessage = '';
                    if (daysOverdue <= 3) {
                        notificationMessage = `⚠️ *Recordatorio de Pago*\n\n` +
                            `Hola ${customer.name}, tu factura tiene ${daysOverdue} día(s) de vencida.\n\n` +
                            `💰 Valor: ${customer.amount.toLocaleString()}\n` +
                            `📅 Venció: ${moment(customer.lastDueDate).format('DD/MM/YYYY')}\n\n` +
                            `Paga hoy para evitar la suspensión del servicio.`;
                    } else if (daysOverdue <= 7) {
                        notificationMessage = `🚨 *Suspensión Inminente*\n\n` +
                            `${customer.name}, tu servicio será suspendido mañana por mora de ${daysOverdue} días.\n\n` +
                            `💰 Valor adeudado: ${customer.amount.toLocaleString()}\n\n` +
                            `¡Paga urgentemente para mantener tu servicio activo!`;
                    }

                    if (notificationMessage) {
                        await this.sendTextMessage(user.phoneNumber, notificationMessage);
                        await this.sendPaymentOptions(user.phoneNumber);
                    }
                }
            }
        } catch (error) {
            console.error('Check overdue invoices error:', error);
        }
    }

    private async checkServiceOutages(): Promise<void> {
        try {
            const outages = await this.getServiceOutages();

            for (const outage of outages) {
                const affectedUsers = await this.getAffectedUsers(outage.area);

                for (const user of affectedUsers) {
                    const whatsappUser = Array.from(this.users.values()).find(u => u.customerId === user.id);

                    if (whatsappUser && whatsappUser.acceptedPrivacyPolicy) {
                        const outageMessage = `🔧 *Mantenimiento Programado*\n\n` +
                            `Estimado ${user.name},\n\n` +
                            `Te informamos que realizaremos mantenimiento en tu zona:\n\n` +
                            `📍 Área: ${outage.area}\n` +
                            `🕐 Inicio: ${moment(outage.startTime).format('DD/MM/YYYY HH:mm')}\n` +
                            `⏰ Duración estimada: ${outage.duration} horas\n\n` +
                            `El servicio se restablecerá automáticamente. Disculpa las molestias.`;

                        await this.sendTextMessage(whatsappUser.phoneNumber, outageMessage);
                    }
                }
            }
        } catch (error) {
            console.error('Check service outages error:', error);
        }
    }

    // Helper methods
    private getInvoiceStatusText(status: string): string {
        switch (status) {
            case 'paid': return 'Pagada';
            case 'pending': return 'Pendiente';
            case 'overdue': return 'Vencida';
            default: return 'Desconocido';
        }
    }

    private getCategoryName(categoryId: string): string {
        const categories: { [key: string]: string } = {
            'internet_lento': 'Internet Lento',
            'sin_internet': 'Sin Conexión a Internet',
            'intermitente': 'Conexión Intermitente',
            'facturacion': 'Problema de Facturación',
            'otro': 'Otro Problema'
        };

        return categories[categoryId] || 'Consulta General';
    }

    private isValidPassword(password: string): boolean {
        const minLength = 8;
        const hasNumber = /\d/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        return password.length >= minLength && hasNumber && hasUpper && hasSpecial;
    }

    // Additional API integration methods
    private async verifyPassword(customerId: string, password: string): Promise<boolean> {
        try {
            const response = await axios.post(`${config.wisphub.baseUrl}/customers/${customerId}/verify-password`, {
                password: password
            }, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data.valid;
        } catch (error) {
            console.error('Verify password error:', error);
            return false;
        }
    }

    private async updatePassword(customerId: string, newPassword: string): Promise<boolean> {
        try {
            await axios.put(`${config.wisphub.baseUrl}/customers/${customerId}/password`, {
                password: newPassword
            }, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return true;
        } catch (error) {
            console.error('Update password error:', error);
            return false;
        }
    }

    private async getCustomerPlan(customerId: string): Promise<any> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/${customerId}/plan`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get customer plan error:', error);
            throw error;
        }
    }

    private async getAvailableUpgrades(customerId: string): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/${customerId}/upgrade-options`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get upgrade options error:', error);
            return [];
        }
    }

    private async getPaymentPoints(): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/payment-points`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get payment points error:', error);
            return [];
        }
    }

    private async notifyNewTicket(ticketId: string, customerId: string): Promise<void> {
        try {
            await axios.post(`${config.crm.baseUrl}/tickets/${ticketId}/notifications`, {
                type: 'whatsapp_created',
                customer_id: customerId
            }, {
                headers: { 'Authorization': `Bearer ${config.crm.apiKey}` }
            });
        } catch (error) {
            console.error('Notify new ticket error:', error);
        }
    }

    private async getOverdueCustomers(): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/overdue`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get overdue customers error:', error);
            return [];
        }
    }

    private async getServiceOutages(): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/outages/scheduled`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get service outages error:', error);
            return [];
        }
    }

    private async getAffectedUsers(area: string): Promise<any[]> {
        try {
            const response = await axios.get(`${config.wisphub.baseUrl}/customers/by-area/${area}`, {
                headers: { 'Authorization': `Bearer ${config.wisphub.apiKey}` }
            });

            return response.data;
        } catch (error) {
            console.error('Get affected users error:', error);
            return [];
        }
    }

    public start(port: number = 3000): void {
        this.app.listen(port, () => {
            console.log(`🤖 Conecta2 WhatsApp Bot running on port ${port}`);
            console.log(`📱 Webhook URL: http://localhost:${port}/webhook`);
            this.startNotificationSystem();
        });
    }
}

// Environment variables validation
function validateEnvironment(): void {
    const requiredVars = [
        'META_ACCESS_TOKEN',
        'WEBHOOK_VERIFY_TOKEN',
        'PHONE_NUMBER_ID',
        'WISPHUB_API_URL',
        'WISPHUB_API_KEY',
        'CRM_API_URL',
        'CRM_API_KEY',
        'OPENAI_API_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        process.exit(1);
    }
}

// Initialize and start the bot
try {
    validateEnvironment();
    const bot = new WhatsAppBot();
    bot.start(process.env.PORT ? parseInt(process.env.PORT) : 3000);
} catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
}

export default WhatsAppBot;
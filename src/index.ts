import express from 'express';
import { config, validateEnvironment } from './config';
import routes from './routes';
import { NotificationController } from './controllers';
import { User } from './interfaces';

// Define interface for request with rawBody
interface RequestWithRawBody extends express.Request {
    rawBody?: Buffer;
}

class WhatsAppBot {
    private app: express.Application;
    private users: Map<string, User> = new Map();

    constructor() {
        this.app = express();

        // Configuración del middleware
        this.app.use(express.json({
            verify: (req, res, buf) => {
                // Use type assertion to tell TypeScript that req has rawBody property
                (req as RequestWithRawBody).rawBody = buf;
            }
        }));
        this.app.use(express.urlencoded({ extended: true }));

        // Logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });

        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Ruta de prueba para verificar que el servidor está funcionando
        this.app.get('/', (req, res) => {
            res.send('WhatsApp Bot is running!');
        });

        // Rutas principales
        this.app.use('/', routes);

        // Manejo de 404
        this.app.use((req, res) => {
            console.log(`404 - Not Found: ${req.method} ${req.path}`);
            res.status(404).json({ error: 'Not Found' });
        });
    }

    public start(port: number = config.server.port): void {
        validateEnvironment();

        this.app.listen(port, () => {
            console.log(`🤖 Conecta2 WhatsApp Bot running on port ${port}`);
            console.log(`📱 Webhook URL: http://localhost:${port}/webhook`);
            console.log(`🔑 Verify Token: ${config.meta.webhookVerifyToken}`);

            // Start notification system
            const notificationController = new NotificationController(this.users);
            notificationController.startNotificationSystem();
        });
    }
}

// Initialize and start the bot
try {
    validateEnvironment();
    const bot = new WhatsAppBot();
    bot.start();
} catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
}

export default WhatsAppBot;
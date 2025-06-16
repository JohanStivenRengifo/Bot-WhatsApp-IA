import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config, validateEnvironment } from './config';
import routes from './routes';
import { NotificationController } from './controllers';
import { User } from './interfaces';
import { WebSocketService } from './services/WebSocketService';
import { MongoDBService } from './services/MongoDBService';
import { CRMServiceMongoDB } from './services/CRMServiceMongoDB';

// Define interface for request with rawBody
interface RequestWithRawBody extends express.Request {
    rawBody?: Buffer;
}

class WhatsAppBot {
    private app: express.Application;
    private server: any;
    private webSocketService: WebSocketService;
    private users: Map<string, User> = new Map();

    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.webSocketService = WebSocketService.getInstance();

        // Configuración CORS para el frontend
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            credentials: true
        }));

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

        // Inicializar WebSocket
        this.webSocketService.initialize(this.server);

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
    } public getApp(): express.Application {
        return this.app;
    }

    public async start(port: number = config.server.port): Promise<void> {
        validateEnvironment();

        try {
            // Conectar a MongoDB
            const mongoService = MongoDBService.getInstance();
            await mongoService.connect();

            // Inicializar CRM Service
            const crmService = CRMServiceMongoDB.getInstance();
            console.log('✅ CRM Service MongoDB inicializado');

            this.server.listen(port, () => {
                console.log(`🤖 Conecta2 WhatsApp Bot running on port ${port}`);
                console.log(`📱 Webhook URL: http://localhost:${port}/webhook`);
                console.log(`🔑 Verify Token: ${config.meta.webhookVerifyToken}`);
                console.log(`🌐 WebSocket server running on port ${port}`);
                console.log(`🎛️ CRM Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
                console.log(`🗄️ MongoDB conectado: ${config.MONGODB_DB_NAME}`);

                // Start notification system
                const notificationController = new NotificationController(this.users);
                notificationController.startNotificationSystem();
            });

        } catch (error) {
            console.error('❌ Error conectando a MongoDB:', error);
            process.exit(1);
        }
    }
}

// Initialize and start the bot
async function startBot() {
    try {
        validateEnvironment();
        const bot = new WhatsAppBot();
        await bot.start();
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// For Vercel serverless deployment, export the app instance
const bot = new WhatsAppBot();

// Initialize MongoDB connection
(async () => {
    try {
        const mongoService = MongoDBService.getInstance();
        await mongoService.connect();
        const crmService = CRMServiceMongoDB.getInstance();
        console.log('✅ CRM Service MongoDB inicializado para Vercel');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB en Vercel:', error);
    }
})();

// Start bot locally if not in serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startBot();
}

// Export the Express app for Vercel
export default bot.getApp();
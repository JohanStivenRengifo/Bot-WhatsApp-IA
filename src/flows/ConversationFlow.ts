import { User, SessionData, WhatsAppMessage } from '../interfaces';
import { MessageService, SecurityService } from '../services';

/**
 * Interfaz base para los flujos conversacionales
 */
export interface ConversationFlow {
    /**
     * Nombre identificativo del flujo
     */
    readonly name: string;

    /**
     * Verifica si el flujo puede manejar el mensaje actual
     * @param user Usuario actual
     * @param message Mensaje recibido (puede ser string o WhatsAppMessage)
     * @param session Datos de sesión actual
     */
    canHandle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean>;

    /**
     * Procesa el mensaje dentro del flujo
     * @param user Usuario actual
     * @param message Mensaje recibido (puede ser string o WhatsAppMessage)
     * @param session Datos de sesión actual
     * @returns true si el mensaje fue manejado completamente, false si debe continuar el procesamiento
     */
    handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean>;
}

/**
 * Clase base abstracta para los flujos conversacionales
 */
export abstract class BaseConversationFlow implements ConversationFlow {
    abstract readonly name: string;

    protected messageService: MessageService;
    protected securityService: SecurityService;

    constructor(messageService: MessageService, securityService: SecurityService) {
        this.messageService = messageService;
        this.securityService = securityService;
    }    // Para compatibilidad, los métodos abstractos siguen siendo para string solamente
    // PaymentReceiptFlow sobrescribirá estos métodos para manejar WhatsAppMessage
    abstract canHandle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean>;
    abstract handle(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean>;

    /**
     * Método utilitario para decodificar datos encriptados del usuario
     */
    protected decodeUserData(user: User): any {
        if (!user.encryptedData) return null;

        try {
            return JSON.parse(this.securityService.decryptSensitiveData(user.encryptedData));
        } catch (error) {
            console.error('Error decrypting user data:', error);
            return null;
        }
    }
}

/**
 * Interfaz para el administrador de flujos conversacionales
 */
export interface FlowManager {
    registerFlow(flow: ConversationFlow): void;
    processMessage(user: User, message: string | WhatsAppMessage, session: SessionData): Promise<boolean>;
}

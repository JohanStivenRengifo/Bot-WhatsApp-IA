import { SessionData } from '../interfaces/WhatsAppMessage';
import { MessageService } from './MessageService';

export class SessionManager {
    private static readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
    private sessions: Map<string, SessionData> = new Map();
    private messageService: MessageService;

    constructor(messageService: MessageService) {
        this.messageService = messageService;
    }

    /**
     * Obtiene o crea una sesión para un usuario
     */
    getSession(phoneNumber: string): SessionData {
        let session = this.sessions.get(phoneNumber);

        if (!session) {
            session = this.createNewSession();
            this.sessions.set(phoneNumber, session);
        }

        this.updateLastActivity(phoneNumber);
        return session;
    }

    /**
     * Actualiza la última actividad de una sesión
     */
    updateLastActivity(phoneNumber: string): void {
        const session = this.sessions.get(phoneNumber);
        if (session) {
            session.lastActivity = new Date();
            this.resetSessionTimeout(phoneNumber, session);
        }
    }

    /**
     * Resetea el timeout de una sesión
     */
    private resetSessionTimeout(phoneNumber: string, session: SessionData): void {
        // Limpiar timeout anterior si existe
        if (session.sessionTimeout) {
            clearTimeout(session.sessionTimeout);
        }

        // Establecer nuevo timeout
        session.sessionTimeout = setTimeout(async () => {
            await this.handleSessionTimeout(phoneNumber);
        }, SessionManager.SESSION_TIMEOUT_MS);
    }    /**
     * Maneja el timeout de una sesión
     */
    private async handleSessionTimeout(phoneNumber: string): Promise<void> {
        const session = this.sessions.get(phoneNumber);
        if (!session) return;

        try {
            // Enviar mensaje de timeout
            await this.messageService.sendTextMessage(phoneNumber,
                '⏰ **Sesión Expirada**\n\n' +
                'Tu sesión ha caducado por inactividad.\n\n' +
                '¡Vuelve a escribir Soporte para continuar!\n\n' +
                '🔐 Por seguridad, deberás autenticarte nuevamente para acceder a los servicios.');

            // Limpiar sesión
            this.clearSession(phoneNumber);

        } catch (error) {
            console.error(`Error enviando mensaje de timeout a ${phoneNumber}:`, error);
            // Limpiar sesión de todas formas
            this.clearSession(phoneNumber);
        }
    }

    /**
     * Limpia una sesión específica
     */
    clearSession(phoneNumber: string): void {
        const session = this.sessions.get(phoneNumber);
        if (session?.sessionTimeout) {
            clearTimeout(session.sessionTimeout);
        }
        this.sessions.delete(phoneNumber);
    }

    /**
     * Limpia todas las sesiones
     */
    clearAllSessions(): void {
        this.sessions.forEach((session) => {
            if (session.sessionTimeout) {
                clearTimeout(session.sessionTimeout);
            }
        });
        this.sessions.clear();
    }

    /**
     * Crea una nueva sesión
     */
    private createNewSession(): SessionData {
        return {
            changingPassword: false,
            creatingTicket: false,
            lastActivity: new Date()
        };
    }

    /**
     * Verifica si una sesión está activa
     */
    isSessionActive(phoneNumber: string): boolean {
        const session = this.sessions.get(phoneNumber);
        if (!session || !session.lastActivity) {
            return false;
        }

        const now = new Date();
        const timeDiff = now.getTime() - session.lastActivity.getTime();
        return timeDiff < SessionManager.SESSION_TIMEOUT_MS;
    }

    /**
     * Obtiene información de la sesión
     */
    getSessionInfo(phoneNumber: string): {
        exists: boolean;
        active: boolean;
        timeRemaining?: number;
        lastActivity?: Date;
    } {
        const session = this.sessions.get(phoneNumber);

        if (!session) {
            return { exists: false, active: false };
        }

        const isActive = this.isSessionActive(phoneNumber);
        let timeRemaining: number | undefined;

        if (isActive && session.lastActivity) {
            const elapsed = new Date().getTime() - session.lastActivity.getTime();
            timeRemaining = Math.max(0, SessionManager.SESSION_TIMEOUT_MS - elapsed);
        }

        return {
            exists: true,
            active: isActive,
            timeRemaining,
            lastActivity: session.lastActivity
        };
    }

    /**
     * Extiende la sesión (resetea el timeout)
     */
    extendSession(phoneNumber: string): boolean {
        const session = this.sessions.get(phoneNumber);
        if (session && this.isSessionActive(phoneNumber)) {
            this.updateLastActivity(phoneNumber);
            return true;
        }
        return false;
    }

    /**
     * Obtiene estadísticas de sesiones
     */
    getSessionStats(): {
        totalSessions: number;
        activeSessions: number;
        expiredSessions: number;
    } {
        let activeSessions = 0;
        let expiredSessions = 0;

        this.sessions.forEach((session, phoneNumber) => {
            if (this.isSessionActive(phoneNumber)) {
                activeSessions++;
            } else {
                expiredSessions++;
            }
        });

        return {
            totalSessions: this.sessions.size,
            activeSessions,
            expiredSessions
        };
    }

    /**
     * Limpia sesiones expiradas
     */
    cleanupExpiredSessions(): void {
        const expiredSessions: string[] = [];

        this.sessions.forEach((session, phoneNumber) => {
            if (!this.isSessionActive(phoneNumber)) {
                expiredSessions.push(phoneNumber);
            }
        });

        expiredSessions.forEach(phoneNumber => {
            this.clearSession(phoneNumber);
        });

        if (expiredSessions.length > 0) {
            console.log(`Limpiadas ${expiredSessions.length} sesiones expiradas`);
        }
    }
}

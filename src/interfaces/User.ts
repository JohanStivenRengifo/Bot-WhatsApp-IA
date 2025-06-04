import { SessionData } from './WhatsAppMessage';

export interface User {
    phoneNumber: string;
    authenticated: boolean;
    acceptedPrivacyPolicy: boolean;
    customerId?: string;
    sessionData?: SessionData;
    sessionId?: string;
    sessionExpiresAt?: Date;
    lastActivity?: Date;
    encryptedData?: string;
    awaitingDocument?: boolean;

    // Nuevas propiedades para el sistema mejorado
    hasSelectedService?: boolean;
    preferredLanguage?: 'es' | 'en';
    userServices?: Array<{
        id: string;
        name: string;
        status: 'active' | 'inactive' | 'suspended';
        plan: string;
    }>;

    // Para manejo de múltiples servicios
    currentServiceId?: string;

    // Configuración de IA personal
    aiContext?: {
        previousInteractions: number;
        preferredResponseStyle: 'formal' | 'friendly' | 'technical';
        lastTopics: string[];
    };
}
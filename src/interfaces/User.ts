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
}
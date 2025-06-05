import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';

/**
 * Flujo de autenticación de usuarios
 */
export class AuthenticationFlow extends BaseConversationFlow {
    readonly name: string = 'authentication';

    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
    }    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo solo maneja mensajes cuando:
        // 1. El usuario ha seleccionado soporte técnico y está esperando un documento
        // 2. El usuario ha seleccionado soporte técnico y no está autenticado
        // 3. El usuario acepta la política de privacidad y necesita autenticarse para soporte

        const selectedSoporte = session.selectedService === 'soporte' ||
            message.toLowerCase().includes('soporte') ||
            message.toLowerCase().includes('técnico');

        return (user.awaitingDocument && !user.authenticated && selectedSoporte) ||
            (!user.authenticated && selectedSoporte && user.acceptedPrivacyPolicy);
    }

    /**
     * Maneja el proceso de autenticación
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {        // Si está esperando un documento, verificar formato
            if (user.awaitingDocument && !/^\d{1,12}$/.test(message)) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ El formato debe contener entre 1 y 12 dígitos numéricos.\n\n' +
                    'Puedes ingresar:\n' +
                    '• Tu número de cédula/documento de identidad\n' +
                    '• Tu ID de servicio (número de cliente)\n\n' +
                    'Por favor, ingresa solo los números (sin espacios ni guiones):');
                return true;
            }

            // Si no está en modo de espera y el mensaje no es un documento válido
            if (!user.awaitingDocument && !/^\d{1,12}$/.test(message)) {
                await this.messageService.sendTextMessage(user.phoneNumber,
                    '❌ El formato debe contener entre 1 y 12 dígitos numéricos.\n\n' +
                    'Puedes ingresar:\n' +
                    '• Tu número de cédula/documento de identidad\n' +
                    '• Tu ID de servicio (número de cliente)\n\n' +
                    'Por favor, ingresa solo los números (sin espacios ni guiones):');

                // Establecer modo de espera
                user.awaitingDocument = true;
                return true;
            }

            // Quitar el estado de espera
            user.awaitingDocument = false;

            // Autenticar con el servicio de clientes
            const customerData = await this.customerService.authenticateCustomer(message);

            if (customerData) {
                // Verificar si el servicio está inactivo
                if (customerData.isInactive) {
                    await this.handleInactiveCustomer(user, customerData);
                } else {
                    // Autenticación exitosa para usuario activo
                    await this.handleSuccessfulAuthentication(user, customerData);
                }
                return true;
            } else {
                // Falló la autenticación
                await this.handleFailedAuthentication(user);
                return true;
            }
        } catch (error) {
            console.error('Error en flujo de autenticación:', error);

            // Registrar intento fallido
            this.securityService.recordAuthAttempt(user.phoneNumber, false);

            await this.messageService.sendTextMessage(user.phoneNumber,
                'Error en la autenticación. Intenta nuevamente en unos momentos.');
            return true;
        }
    }

    /**
     * Maneja el caso de un cliente con servicio inactivo
     */
    private async handleInactiveCustomer(user: User, customerData: any): Promise<void> {
        await this.messageService.sendTextMessage(user.phoneNumber,
            `⚠️ Hola ${customerData.name && customerData.name !== 'Cliente' ? customerData.name : 'estimado(a) cliente'},\n\n` +
            `Hemos identificado que tu servicio se encuentra actualmente inactivo (Estado: ${customerData.status}).\n\n` +
            `Para reactivar tu servicio o resolver cualquier inconveniente con tu cuenta, por favor:\n\n` +
            `1️⃣ Contacta a nuestro equipo de atención al cliente\n` +
            `2️⃣ Verifica si tienes pagos pendientes\n` +
            `3️⃣ Consulta el estado de tu facturación\n\n` +
            `¿Deseas que te ayude a revisar tu estado de cuenta?`);// Crear sesión temporal
        this.securityService.recordAuthAttempt(user.phoneNumber, true);

        user.authenticated = true; user.customerId = customerData.id;
        user.sessionId = this.securityService.createSession(user.phoneNumber);
        user.sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
        user.lastActivity = new Date();        // Guardar datos encriptados pero marcar como inactivo
        user.encryptedData = this.securityService.encryptSensitiveData(JSON.stringify({
            customerId: customerData.id,
            id_servicio: customerData.id,
            customerName: customerData.name,
            ip_address: customerData.ip_address,
            email: customerData.email,
            document: customerData.document,
            status: customerData.status,
            isInactive: true
        }));

        // Mostrar opciones limitadas
        await this.messageService.sendLimitedOptionsMenu(user.phoneNumber);
    }

    /**
     * Maneja autenticación exitosa de un cliente activo
     */
    private async handleSuccessfulAuthentication(user: User, customerData: any): Promise<void> {
        this.securityService.recordAuthAttempt(user.phoneNumber, true); user.authenticated = true;
        user.customerId = customerData.id;

        // Crear sesión segura
        const sessionId = this.securityService.createSession(user.phoneNumber);
        user.sessionId = sessionId;
        user.sessionExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas
        user.lastActivity = new Date();        // Encriptar datos sensibles con información completa del servicio
        user.encryptedData = this.securityService.encryptSensitiveData(JSON.stringify({
            customerId: customerData.id,
            id_servicio: customerData.id,
            customerName: customerData.name,
            ip_address: customerData.ip_address,
            email: customerData.email,
            document: customerData.document,
            status: customerData.status
        })); await this.messageService.sendTextMessage(user.phoneNumber,
            `✅ ¡Hola ${customerData.name && customerData.name !== 'Cliente' ? customerData.name : 'estimado(a) cliente'}!\n\n` +
            'Autenticación exitosa. Tu sesión estará activa por 2 horas.\n\n' +
            '🔒 Sesión segura iniciada\n' +
            '⏰ Expiración automática por seguridad');

        // Mostrar el menú principal
        await this.messageService.sendMainMenu(user.phoneNumber);
    }

    /**
     * Maneja el caso de autenticación fallida
     */
    private async handleFailedAuthentication(user: User): Promise<void> {
        const canRetry = this.securityService.recordAuthAttempt(user.phoneNumber, false);
        const remainingAttempts = this.securityService.getRemainingAuthAttempts(user.phoneNumber);

        if (!canRetry) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '🔒 Demasiados intentos fallidos de autenticación.\n\n' +
                'Tu cuenta ha sido bloqueada temporalmente por 15 minutos por seguridad.\n\n' +
                'Si necesitas ayuda inmediata, contacta a nuestro equipo de soporte.');
        } else {
            await this.messageService.sendTextMessage(user.phoneNumber,
                `❌ No pude encontrar tu información con esos datos.\n\n` +
                `Verifica que hayas ingresado correctamente:\n` +
                `• Tu número de cédula/documento de identidad, O\n` +
                `• Tu ID de servicio (número de cliente)\n\n` +
                `⚠️ Intentos restantes: ${remainingAttempts}\n\n` +
                `Si continúas teniendo problemas, escribe "ayuda" para contactar a un agente.`);
        }
    }
}

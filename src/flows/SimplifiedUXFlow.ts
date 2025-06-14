import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService } from '../services';
import { extractMenuCommand } from '../utils/messageUtils';

/**
 * Flujo especializado para usuarios que necesitan una experiencia más simple
 * Se activa cuando se detectan patrones de confusión o para usuarios rurales
 */
export class SimplifiedUXFlow extends BaseConversationFlow {
    readonly name: string = 'simplifiedUX';

    constructor(messageService: MessageService, securityService: SecurityService) {
        super(messageService, securityService);
    }

    /**
     * Verifica si este flujo debe manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        // Este flujo maneja mensajes cuando:
        // 1. El usuario está marcado para UX simplificada
        // 2. Se detectan patrones de confusión
        // 3. El usuario solicita ayuda explícitamente

        if (session.simplifiedUXPreferred) {
            return true;
        }

        // Detectar patrones de confusión
        const confusionPatterns = [
            'no entiendo', 'ayuda', 'help', 'no se', 'no sé', 'como', 'cómo',
            'que hago', 'qué hago', 'perdido', 'confundido', 'no funciona',
            'error', 'problema', 'no puedo', 'dificil', 'difícil'
        ];

        const messageLC = message.toLowerCase();
        const showsConfusion = confusionPatterns.some(pattern =>
            messageLC.includes(pattern)
        );

        if (showsConfusion) {
            // Marcar al usuario para UX simplificada
            session.simplifiedUXPreferred = true;
            return true;
        }

        // Si ya tiene múltiples errores, activar automáticamente
        if ((session.confusionCount || 0) >= 2 || (session.incorrectCommandCount || 0) >= 3) {
            session.simplifiedUXPreferred = true;
            return true;
        }

        return false;
    }

    /**
     * Maneja la interacción con UX simplificada
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const extractedCommand = extractMenuCommand(message);

        try {
            // Respuestas más simples y directas
            if (this.isHelpRequest(message)) {
                await this.sendSimplifiedHelp(user.phoneNumber, user.authenticated);
                return true;
            }

            // Navegación simplificada
            if (extractedCommand === 'menu' || extractedCommand === 'inicio') {
                await this.sendSimplifiedMainMenu(user.phoneNumber, user.authenticated);
                return true;
            }

            // Manejo de comandos básicos con explicaciones simples
            switch (extractedCommand) {
                case 'ventas':
                    session.selectedService = 'ventas';
                    session.flowActive = 'sales';
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '👋 ¡Perfecto!\n\n' +
                        'Te voy a ayudar con información sobre nuestros servicios.\n\n' +
                        '¿Qué te interesa?\n' +
                        '1️⃣ Internet\n' +
                        '2️⃣ TV\n' +
                        '3️⃣ Paquetes completos\n\n' +
                        'Solo escribe el número (ejemplo: 1)');
                    return false; // Permitir que SalesFlow maneje

                case 'soporte':
                    session.selectedService = 'soporte';
                    if (!user.authenticated) {
                        await this.messageService.sendTextMessage(user.phoneNumber,
                            '🔧 Te voy a ayudar con soporte técnico.\n\n' +
                            'Necesito que me des tu número de documento o cliente.\n\n' +
                            'Solo escribe los números, por ejemplo: 12345678');
                        user.awaitingDocument = true;
                        return false; // Permitir que AuthenticationFlow maneje
                    } else {
                        await this.sendSimplifiedTechnicalMenu(user.phoneNumber);
                        return true;
                    }

                case 'hablar_agente':
                case 'agente':
                case 'asesor':
                    session.flowActive = 'agentHandover';
                    await this.messageService.sendTextMessage(user.phoneNumber,
                        '👨‍💼 Te voy a conectar con un agente humano.\n\n' +
                        'En un momento te atenderá una persona real.\n\n' +
                        'Por favor espera...');
                    return false; // Permitir que AgentHandoverFlow maneje

                default:
                    // Comando no reconocido, mostrar opciones simples
                    await this.handleUnrecognizedInput(user, message, session);
                    return true;
            }

        } catch (error) {
            console.error('Error en flujo UX simplificada:', error);
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ Ups, algo salió mal.\n\n' +
                'Voy a mostrarte las opciones principales:');
            await this.sendSimplifiedMainMenu(user.phoneNumber, user.authenticated);
            return true;
        }
    }

    /**
     * Detecta si el mensaje es una solicitud de ayuda
     */
    private isHelpRequest(message: string): boolean {
        const helpPatterns = [
            'ayuda', 'help', 'no entiendo', 'no se', 'no sé', 'como', 'cómo',
            'que hago', 'qué hago', 'perdido', 'confundido', 'explicar'
        ];

        const messageLC = message.toLowerCase();
        return helpPatterns.some(pattern => messageLC.includes(pattern));
    }

    /**
     * Envía ayuda simplificada
     */
    private async sendSimplifiedHelp(phoneNumber: string, isAuthenticated: boolean): Promise<void> {
        const helpMessage = '🆘 **AYUDA RÁPIDA**\n\n' +
            'Estas son las cosas que puedes hacer:\n\n' +
            '🔵 **Para servicios nuevos:**\n' +
            'Escribe: ventas\n\n' +
            '🔧 **Para problemas técnicos:**\n' +
            'Escribe: soporte\n\n' +
            '👨‍💼 **Hablar con una persona:**\n' +
            'Escribe: agente\n\n' +
            '📋 **Ver opciones:**\n' +
            'Escribe: menu\n\n' +
            '💡 **Consejo:** Solo escribe una palabra, por ejemplo "ventas"';

        await this.messageService.sendTextMessage(phoneNumber, helpMessage);
    }

    /**
     * Envía menú principal simplificado
     */
    private async sendSimplifiedMainMenu(phoneNumber: string, isAuthenticated: boolean): Promise<void> {
        if (isAuthenticated) {
            await this.messageService.sendSimplifiedMenu(phoneNumber);
        } else {
            await this.messageService.sendTextMessage(phoneNumber,
                '📋 **MENÚ PRINCIPAL**\n\n' +
                'Elige una opción:\n\n' +
                '🔵 **ventas** - Para servicios nuevos\n' +
                '🔧 **soporte** - Para problemas técnicos\n' +
                '👨‍💼 **agente** - Hablar con una persona\n\n' +
                'Solo escribe la palabra, por ejemplo: ventas');
        }
    }

    /**
     * Envía menú técnico simplificado
     */
    private async sendSimplifiedTechnicalMenu(phoneNumber: string): Promise<void> {
        await this.messageService.sendTextMessage(phoneNumber,
            '🔧 **SOPORTE TÉCNICO**\n\n' +
            'Elige qué necesitas:\n\n' +
            '1️⃣ **ping** - Revisar conexión\n' +
            '2️⃣ **ticket** - Reportar problema\n' +
            '3️⃣ **factura** - Ver facturas\n' +
            '4️⃣ **agente** - Hablar con técnico\n\n' +
            'Solo escribe la palabra, por ejemplo: ping');
    }

    /**
     * Maneja entrada no reconocida con sugerencias simples
     */
    private async handleUnrecognizedInput(user: User, message: string, session: SessionData): Promise<void> {
        // Incrementar contador de confusión
        session.confusionCount = (session.confusionCount || 0) + 1;

        const suggestions = [
            'No entendí lo que escribiste 😅\n\n',
            'Usa palabras simples como:\n',
            '• "ventas" para servicios nuevos\n',
            '• "soporte" para problemas\n',
            '• "agente" para hablar con una persona\n',
            '• "menu" para ver opciones\n\n',
            '💡 Solo escribe una palabra, por ejemplo: ventas'
        ].join('');

        await this.messageService.sendTextMessage(user.phoneNumber, suggestions);
    }
}

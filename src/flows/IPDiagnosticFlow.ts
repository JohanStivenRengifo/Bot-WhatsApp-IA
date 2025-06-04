import { WhatsAppMessage, SessionData } from '../interfaces/WhatsAppMessage';
import { User } from '../interfaces/User';
import { MessageService } from '../services/MessageService';
import { AIService } from '../services/AIService';
import { CustomerService } from '../services/CustomerService';
import { ConversationFlow } from './ConversationFlow';

interface IPDiagnosticSession extends SessionData {
    runningDiagnostic?: boolean;
    diagnosticType?: 'basic' | 'advanced' | 'speed_test' | 'connectivity';
    targetIP?: string;
    currentStep?: number;
    customerName?: string;
    customerCode?: string;
    sessionId?: string;
    diagnosticResults?: {
        ping?: PingResult;
        traceroute?: TracerouteResult;
        speedTest?: SpeedTestResult;
        connectivity?: ConnectivityResult;
    };
    troubleshooting?: boolean;
    issueResolved?: boolean;
}

interface PingResult {
    success: boolean;
    avgLatency?: number;
    packetLoss?: number;
    details: string[];
}

interface TracerouteResult {
    success: boolean;
    hops: Array<{
        hop: number;
        ip: string;
        latency: number;
    }>;
    details: string[];
}

interface SpeedTestResult {
    downloadSpeed: number;
    uploadSpeed: number;
    ping: number;
    jitter: number;
    server: string;
}

interface ConnectivityResult {
    dnsResolution: boolean;
    internetAccess: boolean;
    gatewayReachable: boolean;
    issues: string[];
}

export class IPDiagnosticFlow implements ConversationFlow {
    readonly name = 'IPDiagnosticFlow';

    private messageService: MessageService;
    private aiService: AIService;
    private customerService: CustomerService;

    constructor(messageService: MessageService, aiService: AIService, customerService: CustomerService) {
        this.messageService = messageService;
        this.aiService = aiService;
        this.customerService = customerService;
    }

    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        const diagnosticSession = session as IPDiagnosticSession;
        return message.toLowerCase().trim() === 'diagnostico_ip' ||
            diagnosticSession.runningDiagnostic === true ||
            diagnosticSession.troubleshooting === true;
    }

    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        const diagnosticSession = session as IPDiagnosticSession;
        const mockMessage: WhatsAppMessage = {
            from: user.phoneNumber,
            id: `msg_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'text',
            text: { body: message }
        };

        return await this.handleMessage(mockMessage, diagnosticSession);
    }

    async handleMessage(message: WhatsAppMessage, session: IPDiagnosticSession): Promise<boolean> {
        const userMessage = message.text?.body?.toLowerCase().trim();

        if (!session.runningDiagnostic && userMessage === 'diagnostico_ip') {
            return await this.startDiagnostic(message, session);
        }

        if (session.runningDiagnostic && !session.troubleshooting) {
            return await this.processDiagnosticFlow(message, session, userMessage || '');
        }

        if (session.troubleshooting) {
            return await this.handleTroubleshooting(message, session, userMessage || '');
        }

        return false;
    }

    private async startDiagnostic(message: WhatsAppMessage, session: IPDiagnosticSession): Promise<boolean> {
        session.runningDiagnostic = true;
        session.currentStep = 0;
        session.customerName = session.customerName || 'Cliente';
        session.customerCode = session.customerCode || 'N/A';
        session.sessionId = `DIAG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        const diagnosticMenu = `
🔍 *DIAGNÓSTICO DE CONECTIVIDAD IP*

Selecciona el tipo de diagnóstico que necesitas:

*1️⃣ Ping básico* - Verificar conectividad simple
*2️⃣ Diagnóstico avanzado* - Ping + Traceroute
*3️⃣ Test de velocidad* - Medir ancho de banda
*4️⃣ Conectividad completa* - Análisis integral
*5️⃣ IP personalizada* - Hacer ping a dirección específica

*0️⃣ Regresar*

_Selecciona una opción:_`;

        await this.messageService.sendTextMessage(message.from, diagnosticMenu);
        return true;
    }

    private async processDiagnosticFlow(
        message: WhatsAppMessage,
        session: IPDiagnosticSession,
        userMessage: string
    ): Promise<boolean> {
        switch (session.currentStep) {
            case 0:
                return await this.handleDiagnosticTypeSelection(message, session, userMessage);
            case 1:
                return await this.handleCustomIPInput(message, session, userMessage);
            case 2:
                return await this.executeDiagnostic(message, session);
            case 3:
                return await this.showResults(message, session, userMessage);
            default:
                return false;
        }
    }

    private async handleDiagnosticTypeSelection(message: WhatsAppMessage, session: IPDiagnosticSession, userMessage: string): Promise<boolean> {
        const diagnosticTypes = {
            '1': 'basic',
            '2': 'advanced',
            '3': 'speed_test',
            '4': 'connectivity',
            '5': 'custom'
        };

        if (userMessage === '0') {
            session.runningDiagnostic = false;
            await this.messageService.sendTextMessage(message.from, "Has regresado al menú anterior. ¿En qué más puedo ayudarte?");
            return true;
        }

        const selectedType = diagnosticTypes[userMessage as keyof typeof diagnosticTypes];
        if (!selectedType) {
            await this.messageService.sendTextMessage(
                message.from,
                "❌ Opción no válida. Por favor selecciona un número del 1 al 5, o 0 para regresar."
            );
            return true;
        }

        session.diagnosticType = selectedType as 'basic' | 'advanced' | 'speed_test' | 'connectivity';

        if (selectedType === 'custom') {
            session.currentStep = 1;
            const customIPMessage = `
🎯 *PING A IP PERSONALIZADA*

Ingresa la dirección IP o dominio al que quieres hacer ping:

_Ejemplos:_
• 8.8.8.8 (DNS de Google)
• 1.1.1.1 (DNS de Cloudflare)
• google.com
• facebook.com

*Escribe la dirección:*`;

            await this.messageService.sendTextMessage(message.from, customIPMessage);
            return true;
        } else {
            session.currentStep = 2;
            return await this.executeDiagnostic(message, session);
        }
    }

    private async handleCustomIPInput(message: WhatsAppMessage, session: IPDiagnosticSession, userMessage: string): Promise<boolean> {
        const ipInput = userMessage.trim();

        // Validación básica de IP o dominio
        const isValidIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(ipInput);
        const isValidDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(ipInput);

        if (!isValidIP && !isValidDomain && !ipInput.includes('.')) {
            await this.messageService.sendTextMessage(
                message.from,
                "❌ Por favor ingresa una dirección IP o dominio válido."
            );
            return true;
        }

        if (isValidIP && !this.isValidIPAddress(ipInput)) {
            await this.messageService.sendTextMessage(
                message.from,
                "❌ Formato no válido. Ingresa una IP (ej: 8.8.8.8) o dominio (ej: google.com)."
            );
            return true;
        }

        session.targetIP = ipInput;
        session.currentStep = 2;
        return await this.executeDiagnostic(message, session);
    }

    private async executeDiagnostic(message: WhatsAppMessage, session: IPDiagnosticSession): Promise<boolean> {
        const loadingMessage = `
⏳ *EJECUTANDO DIAGNÓSTICO*

Tipo: ${this.getDiagnosticTypeName(session.diagnosticType!)}
${session.targetIP ? `Destino: ${session.targetIP}` : 'Destino: Servidores predeterminados'}

_Esto puede tomar unos segundos..._`;

        await this.messageService.sendTextMessage(message.from, loadingMessage);

        // Simular ejecución del diagnóstico
        await this.simulateDiagnostic(session);

        session.currentStep = 3;
        return await this.showResults(message, session, '');
    }

    private async showResults(message: WhatsAppMessage, session: IPDiagnosticSession, userMessage: string): Promise<boolean> {
        if (!userMessage) {
            // Primera vez mostrando resultados
            const results = session.diagnosticResults!;
            const resultMessage = this.formatDiagnosticResults(session);

            await this.messageService.sendTextMessage(message.from, resultMessage);

            // Mostrar opciones post-diagnóstico
            const optionsMessage = `
🔧 *¿QUÉ QUIERES HACER AHORA?*

*1️⃣ Solucionar problemas* - Si hay issues detectados
*2️⃣ Exportar resultados* - Guardar/enviar reporte
*3️⃣ Nuevo diagnóstico* - Ejecutar otra prueba
*4️⃣ Contactar soporte* - Hablar con técnico
*0️⃣ Finalizar*

_Selecciona una opción:_`;

            await this.messageService.sendTextMessage(message.from, optionsMessage);
            return true;
        }

        // Manejo de opciones post-diagnóstico
        switch (userMessage) {
            case '0':
                session.runningDiagnostic = false;
                await this.messageService.sendTextMessage(message.from, "Has regresado al menú principal.");
                return true;
            case '1':
                return await this.startTroubleshooting(message, session);
            case '2':
                return await this.exportResults(message, session);
            case '3':
                session.currentStep = 0;
                session.diagnosticResults = undefined;
                return await this.startDiagnostic(message, session);
            case '4':
                return await this.contactTechnicalSupport(message, session);
            default:
                await this.messageService.sendTextMessage(
                    message.from,
                    "❌ Opción no válida. Selecciona una opción del 0 al 4."
                );
                return true;
        }
    }

    private async startTroubleshooting(message: WhatsAppMessage, session: IPDiagnosticSession): Promise<boolean> {
        session.troubleshooting = true;

        // Identificar problemas basados en los resultados
        const issues = this.identifyIssues(session.diagnosticResults);

        if (issues.length === 0) {
            await this.messageService.sendTextMessage(
                message.from,
                "✅ *No se detectaron problemas significativos*\n\nTu conexión parece estar funcionando correctamente. Si experimentas problemas específicos, contacta a soporte técnico."
            );
            session.troubleshooting = false;
            return true;
        }

        const troubleshootingMessage = `
🔧 *Solución de Problemas Detectados*

Se encontraron los siguientes problemas:

${issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

🔄 *Soluciones recomendadas:*

*1️⃣ Reiniciar módem/router*
*2️⃣ Verificar cables de red*
*3️⃣ Cambiar DNS a 8.8.8.8*
*4️⃣ Contactar soporte técnico*
*0️⃣ Volver a resultados*

_Selecciona una opción:_`;

        await this.messageService.sendTextMessage(message.from, troubleshootingMessage);
        return true;
    }

    private async handleTroubleshooting(message: WhatsAppMessage, session: IPDiagnosticSession, userMessage: string): Promise<boolean> {
        const solutions = {
            '1': {
                title: 'Reiniciar Módem/Router',
                steps: [
                    '1. Desconecta el cable de poder del módem',
                    '2. Espera 30 segundos',
                    '3. Reconecta el cable de poder',
                    '4. Espera 2-3 minutos hasta que todas las luces estén estables',
                    '5. Prueba tu conexión nuevamente'
                ]
            },
            '2': {
                title: 'Verificar Cables de Red',
                steps: [
                    '1. Revisa que todos los cables estén bien conectados',
                    '2. Verifica que no haya cables dañados o doblados',
                    '3. Asegúrate de que el cable ethernet esté bien conectado',
                    '4. Prueba con un cable diferente si es posible'
                ]
            },
            '3': {
                title: 'Cambiar DNS',
                steps: [
                    '1. Ve a Configuración de Red en tu dispositivo',
                    '2. Busca configuración de DNS',
                    '3. Cambia a DNS público: 8.8.8.8 y 8.8.4.4',
                    '4. Guarda los cambios y reinicia tu conexión'
                ]
            },
            '4': {
                title: 'Contactar Soporte Técnico',
                steps: [
                    '1. Ten a mano tu código de cliente',
                    '2. Anota los resultados del diagnóstico',
                    '3. Usa el menú principal para contactar soporte',
                    '4. Menciona que ya ejecutaste un diagnóstico'
                ]
            }
        };

        if (userMessage === '0') {
            session.troubleshooting = false;
            return await this.showResults(message, session, '');
        }

        const solution = solutions[userMessage as keyof typeof solutions];
        if (!solution) {
            await this.messageService.sendTextMessage(
                message.from,
                "❌ Opción no válida. Selecciona del 1 al 4, o 0 para volver."
            );
            return true;
        }

        const solutionMessage = `
🔧 *${solution.title}*

${solution.steps.map(step => `${step}`).join('\n')}

¿Te ayudó esta solución?

*1️⃣ Sí, problema resuelto*
*2️⃣ No, sigue el problema*
*3️⃣ Intentar otra solución*
*0️⃣ Volver*`;

        await this.messageService.sendTextMessage(message.from, solutionMessage);
        return true;
    }

    private async exportResults(message: WhatsAppMessage, session: IPDiagnosticSession): Promise<boolean> {
        const timestamp = new Date().toLocaleString('es-ES');
        const exportData = `
📊 *REPORTE DE DIAGNÓSTICO DE RED*

**Fecha:** ${timestamp}
**Cliente:** ${session.customerName} (${session.customerCode})
**ID de sesión:** ${session.sessionId}

${this.formatDiagnosticResults(session, true)}

---
*Generado automáticamente por el sistema de diagnósticos*`;

        await this.messageService.sendTextMessage(message.from, exportData);
        await this.messageService.sendTextMessage(
            message.from,
            "📧 *Reporte enviado*\n\nEl reporte también ha sido guardado en tu historial de diagnósticos.\n\n¿Necesitas algo más?"
        );
        return true;
    }

    private async contactTechnicalSupport(message: WhatsAppMessage, session: IPDiagnosticSession): Promise<boolean> {
        const supportMessage = `
📞 *TRANSFERIR A SOPORTE TÉCNICO*

Basado en los resultados del diagnóstico, se te transferirá a un técnico especializado.

**Información que será compartida:**
• Resultados del diagnóstico
• Problemas detectados
• Tu código de cliente

**Tiempo estimado de espera:** 5-10 minutos

*¿Confirmas la transferencia?*

*1️⃣ Sí, transferir ahora*
*2️⃣ No, volver a opciones*`;

        await this.messageService.sendTextMessage(message.from, supportMessage);
        return true;
    }

    private async simulateDiagnostic(session: IPDiagnosticSession): Promise<void> {
        const target = session.targetIP || '8.8.8.8';

        // Simular delay realista
        await new Promise(resolve => setTimeout(resolve, 2000));

        session.diagnosticResults = {};

        switch (session.diagnosticType) {
            case 'basic':
                session.diagnosticResults.ping = this.simulatePing(target);
                break;
            case 'advanced':
                session.diagnosticResults.ping = this.simulatePing(target);
                session.diagnosticResults.traceroute = this.simulateTraceroute(target);
                break;
            case 'speed_test':
                session.diagnosticResults.speedTest = this.simulateSpeedTest();
                break;
            case 'connectivity':
                session.diagnosticResults.ping = this.simulatePing(target);
                session.diagnosticResults.connectivity = this.simulateConnectivity();
                break;
        }
    }

    private simulatePing(target: string): PingResult {
        // Simular resultados de ping realistas
        const success = Math.random() > 0.1; // 90% de éxito
        const avgLatency = success ? Math.floor(Math.random() * 100) + 10 : undefined;
        const packetLoss = success ? Math.floor(Math.random() * 5) : 100;

        return {
            success,
            avgLatency,
            packetLoss,
            details: [
                `PING ${target}: 64 bytes from ${target}`,
                `Tiempo promedio: ${avgLatency || 'N/A'}ms`,
                `Pérdida de paquetes: ${packetLoss}%`,
                success ? 'Conectividad OK' : 'Host unreachable'
            ]
        };
    }

    private simulateTraceroute(target: string): TracerouteResult {
        const hops = [];
        const hopCount = Math.floor(Math.random() * 10) + 5;

        for (let i = 1; i <= hopCount; i++) {
            hops.push({
                hop: i,
                ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                latency: Math.floor(Math.random() * 50) + (i * 5)
            });
        }

        return {
            success: true,
            hops,
            details: [`Ruta hacia ${target} completada`, `${hopCount} saltos identificados`]
        };
    }

    private simulateSpeedTest(): SpeedTestResult {
        return {
            downloadSpeed: Math.floor(Math.random() * 100) + 20,
            uploadSpeed: Math.floor(Math.random() * 30) + 5,
            ping: Math.floor(Math.random() * 50) + 10,
            jitter: Math.floor(Math.random() * 10) + 1,
            server: 'Servidor de prueba Colombia'
        };
    }

    private simulateConnectivity(): ConnectivityResult {
        const issues = [];
        const dnsResolution = Math.random() > 0.2;
        const internetAccess = Math.random() > 0.1;
        const gatewayReachable = Math.random() > 0.05;

        if (!dnsResolution) issues.push('Problemas de resolución DNS');
        if (!internetAccess) issues.push('Sin acceso a internet');
        if (!gatewayReachable) issues.push('Gateway no alcanzable');

        return {
            dnsResolution,
            internetAccess,
            gatewayReachable,
            issues
        };
    }

    private formatDiagnosticResults(session: IPDiagnosticSession, detailed: boolean = false): string {
        const results = session.diagnosticResults!;
        let message = `📊 *RESULTADOS DEL DIAGNÓSTICO*\n\nTipo: ${this.getDiagnosticTypeName(session.diagnosticType!)}\n`;

        if (results.ping) {
            message += `\n🏓 *PING*\n`;
            message += `• Estado: ${results.ping.success ? '✅ Exitoso' : '❌ Fallido'}\n`;
            if (results.ping.avgLatency) {
                message += `• Latencia promedio: ${results.ping.avgLatency}ms\n`;
            }
            message += `• Pérdida de paquetes: ${results.ping.packetLoss}%\n`;
        }

        if (results.speedTest) {
            message += `\n⚡ *TEST DE VELOCIDAD*\n`;
            message += `• Descarga: ${results.speedTest.downloadSpeed} Mbps\n`;
            message += `• Subida: ${results.speedTest.uploadSpeed} Mbps\n`;
            message += `• Ping: ${results.speedTest.ping}ms\n`;
            message += `• Jitter: ${results.speedTest.jitter}ms\n`;
        }

        if (results.traceroute) {
            message += `\n🛣️ *TRACEROUTE*\n`;
            message += `• Saltos: ${results.traceroute.hops.length}\n`;
            message += `• Estado: ${results.traceroute.success ? '✅ Completado' : '❌ Incompleto'}\n`;
        }

        if (results.connectivity) {
            message += `\n🌐 *CONECTIVIDAD*\n`;
            message += `• DNS: ${results.connectivity.dnsResolution ? '✅' : '❌'}\n`;
            message += `• Internet: ${results.connectivity.internetAccess ? '✅' : '❌'}\n`;
            message += `• Gateway: ${results.connectivity.gatewayReachable ? '✅' : '❌'}\n`;
        }

        // Agregar análisis de problemas
        const issues = this.identifyIssues(results);
        if (issues.length > 0) {
            message += `\n⚠️ *PROBLEMAS DETECTADOS*\n`;
            issues.forEach((issue, index) => {
                message += `${index + 1}. ${issue}\n`;
            });
        } else {
            message += `\n✅ *SIN PROBLEMAS DETECTADOS*\n`;
        }

        return message;
    }

    private identifyIssues(results: any): string[] {
        const issues: string[] = [];

        if (results.ping && !results.ping.success) {
            issues.push('Falla en conectividad básica');
        }

        if (results.ping && results.ping.packetLoss > 5) {
            issues.push(`Alta pérdida de paquetes (${results.ping.packetLoss}%)`);
        }

        if (results.ping && results.ping.avgLatency > 100) {
            issues.push(`Latencia alta (${results.ping.avgLatency}ms)`);
        }

        if (results.speedTest && results.speedTest.downloadSpeed < 10) {
            issues.push('Velocidad de descarga baja');
        }

        if (results.connectivity) {
            if (!results.connectivity.dnsResolution) {
                issues.push('Problemas de DNS');
            }
            if (!results.connectivity.internetAccess) {
                issues.push('Sin acceso a internet');
            }
            if (!results.connectivity.gatewayReachable) {
                issues.push('Gateway no alcanzable');
            }
        }

        return issues;
    }

    private getDiagnosticTypeName(type: string): string {
        const names = {
            basic: 'Ping Básico',
            advanced: 'Diagnóstico Avanzado',
            speed_test: 'Test de Velocidad',
            connectivity: 'Conectividad Completa'
        };
        return names[type as keyof typeof names] || type;
    }

    private isValidIPAddress(ip: string): boolean {
        const parts = ip.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    async cleanup(session: IPDiagnosticSession): Promise<void> {
        session.runningDiagnostic = false;
        session.diagnosticType = undefined;
        session.targetIP = undefined;
        session.currentStep = undefined;
        session.diagnosticResults = undefined;
        session.troubleshooting = false;
        session.issueResolved = false;
    }
}

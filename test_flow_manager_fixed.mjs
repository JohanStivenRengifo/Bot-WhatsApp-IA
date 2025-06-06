import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simular las dependencias necesarias
const MockMessageService = {
    sendMainMenu: async (phoneNumber) => {
        console.log(`📱 Enviando menú principal a ${phoneNumber}`);
    },
    sendTextMessage: async (phoneNumber, message) => {
        console.log(`📱 Enviando mensaje a ${phoneNumber}: ${message}`);
    }
};

// Simular extractMenuCommand
function extractMenuCommand(message) {
    if (!message) return '';

    const normalizedMessage = message.toLowerCase().trim();

    const menuPatterns = {
        'ping': 'ping',
        'test de conexión': 'ping',
        'test de conexion': 'ping',
        'verificar estado': 'ping',
        'conexión': 'ping',
        'conexion': 'ping',
        'verificar estado de tu conexión': 'ping',
        '📡 test de conexión': 'ping',
        '📡 test de conexion': 'ping',

        'ticket': 'ticket',
        'soporte técnico': 'ticket',
        'soporte tecnico': 'ticket',
        'reportar problemas': 'ticket',
        'crear ticket': 'ticket',
        'reportar problema': 'ticket',
        'reportar falla': 'ticket',
        'reportar problemas técnicos': 'ticket',
        'reportar problemas tecnico': 'ticket',
        'soporte': 'ticket',
        'ya soy cliente': 'soporte',
        '🔧 soporte técnico': 'ticket',
        '🔧 soporte tecnico': 'ticket',

        'factura': 'factura',
        'mi factura': 'factura',
        'facturas': 'factura',
        'consultar factura': 'factura',
        'consultar y descargar facturas': 'factura',

        'mejorar_plan': 'mejorar_plan',
        'mejorar plan': 'mejorar_plan',
        'upgrade de velocidad': 'mejorar_plan',
        '⬆️ mejorar plan': 'mejorar_plan',
        '⬆ mejorar plan': 'mejorar_plan',
        'mejorar mi plan': 'mejorar_plan',
        'upgrade plan': 'mejorar_plan',

        'menu': 'menu',
        'menú': 'menu',
        'menú principal': 'menu',
        'menu principal': 'menu',
        'inicio': 'menu',
        'volver': 'menu',
        'regresar': 'menu',
        'finalizar': 'finalizar',
        'terminar': 'finalizar',
        'salir': 'finalizar'
    };

    // 1. Verificar si es un ID directo
    if (menuPatterns[normalizedMessage]) {
        return menuPatterns[normalizedMessage];
    }

    // 2. Buscar por patrones que contengan texto específico
    for (const [pattern, command] of Object.entries(menuPatterns)) {
        if (normalizedMessage.includes(pattern)) {
            return command;
        }
    }

    // 3. Verificar si contiene emojis y extraer texto principal
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const textWithoutEmojis = normalizedMessage.replace(emojiPattern, '').trim();

    const titlePart = textWithoutEmojis.split('\n')[0].trim();

    for (const [pattern, command] of Object.entries(menuPatterns)) {
        if (titlePart.includes(pattern) || pattern.includes(titlePart)) {
            return command;
        }
    }

    return normalizedMessage;
}

// Simular el FlowManager
class ConversationFlowManager {
    constructor(messageService) {
        this.flows = [];
        this.messageService = messageService;
    }

    registerFlow(flow) {
        this.flows.push(flow);
        console.log(`✅ Flujo registrado: ${flow.name}`);
    }

    async processMessage(user, message, session) {
        const msgText = typeof message === 'string' ? message : '';
        const command = extractMenuCommand(msgText);

        console.log(`🔍 Procesando mensaje: "${msgText}"`);
        console.log(`🎯 Comando extraído: "${command}"`);

        // Manejar comandos de navegación global
        if (command === 'menu' || command === 'inicio') {
            this.resetSessionFlowState(session);
            await this.messageService.sendMainMenu(user.phoneNumber);
            return true;
        }

        if (command === 'finalizar') {
            this.resetSessionFlowState(session);
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '✅ Gracias por usar nuestro servicio. ¡Hasta pronto! Si necesitas ayuda, escribe "menu" para volver al menú principal.'
            );
            return true;
        }

        // Verificar cada flujo en orden
        for (const flow of this.flows) {
            try {
                if (await flow.canHandle(user, message, session)) {
                    console.log(`✅ Mensaje evaluado por flujo: ${flow.name}`);

                    const handled = await flow.handle(user, message, session);

                    if (handled) {
                        console.log(`🎉 Mensaje completamente manejado por flujo: ${flow.name}`);
                        return true;
                    }

                    console.log(`➡️ Flujo ${flow.name} configuró estado pero delegó manejo a otros flujos`);
                }
            } catch (error) {
                console.error(`❌ Error en flujo ${flow.name}:`, error);
            }
        }

        console.log(`❓ Ningún flujo pudo manejar el mensaje: "${msgText}"`);
        return false;
    }

    resetSessionFlowState(session) {
        session.creatingTicket = false;
        session.consultingInvoices = false;
        session.changingPassword = false;
        session.verifyingPayment = false;
        session.diagnosticInProgress = false;
        session.step = undefined;
        session.flowActive = '';
        session.ticketData = undefined;
        session.category = undefined;
        session.description = undefined;
        session.asunto = undefined;
        session.newPassword = undefined;
    }
}

// Simular flujos
class ClientMenuFlow {
    constructor() {
        this.name = 'ClientMenuFlow';
    }

    async canHandle(user, message, session) {
        const msgText = typeof message === 'string' ? message : '';
        const command = extractMenuCommand(msgText);

        const supportedCommands = ['ping', 'ticket', 'factura', 'mejorar_plan'];
        const canHandle = supportedCommands.includes(command);

        console.log(`  🔍 ClientMenuFlow evaluando comando "${command}": ${canHandle ? 'SÍ' : 'NO'}`);
        return canHandle;
    }

    async handle(user, message, session) {
        const msgText = typeof message === 'string' ? message : '';
        const command = extractMenuCommand(msgText);

        console.log(`  ⚙️ ClientMenuFlow procesando comando: ${command}`);

        switch (command) {
            case 'ping':
                session.diagnosticInProgress = true;
                console.log(`  📋 Configurando session.diagnosticInProgress = true`);
                return false; // Delegar a IPDiagnosticFlow

            case 'ticket':
                session.creatingTicket = true;
                console.log(`  🎫 Configurando session.creatingTicket = true`);
                return false; // Delegar a TicketCreationFlow

            case 'mejorar_plan':
                session.upgradingPlan = true;
                console.log(`  📈 Configurando session.upgradingPlan = true`);
                return false; // Delegar a PlanUpgradeFlow

            default:
                return false;
        }
    }
}

class IPDiagnosticFlow {
    constructor() {
        this.name = 'IPDiagnosticFlow';
    }

    async canHandle(user, message, session) {
        const canHandle = session.diagnosticInProgress === true;
        console.log(`  🔍 IPDiagnosticFlow evaluando: diagnosticInProgress = ${session.diagnosticInProgress} → ${canHandle ? 'SÍ' : 'NO'}`);
        return canHandle;
    }

    async handle(user, message, session) {
        console.log(`  🔧 IPDiagnosticFlow manejando diagnóstico`);

        // Simular proceso de diagnóstico
        console.log(`  📡 Iniciando test de conexión para ${user.phoneNumber}...`);
        session.diagnosticInProgress = false;

        return true; // Mensaje completamente manejado
    }
}

class TicketCreationFlow {
    constructor() {
        this.name = 'TicketCreationFlow';
    }

    async canHandle(user, message, session) {
        const canHandle = session.creatingTicket === true;
        console.log(`  🔍 TicketCreationFlow evaluando: creatingTicket = ${session.creatingTicket} → ${canHandle ? 'SÍ' : 'NO'}`);
        return canHandle;
    }

    async handle(user, message, session) {
        console.log(`  🎫 TicketCreationFlow manejando creación de ticket`);

        // Simular proceso de creación de ticket
        console.log(`  📝 Iniciando creación de ticket para ${user.phoneNumber}...`);
        session.creatingTicket = false;

        return true; // Mensaje completamente manejado
    }
}

class PlanUpgradeFlow {
    constructor() {
        this.name = 'PlanUpgradeFlow';
    }

    async canHandle(user, message, session) {
        const canHandle = session.upgradingPlan === true;
        console.log(`  🔍 PlanUpgradeFlow evaluando: upgradingPlan = ${session.upgradingPlan} → ${canHandle ? 'SÍ' : 'NO'}`);
        return canHandle;
    }

    async handle(user, message, session) {
        console.log(`  📈 PlanUpgradeFlow manejando upgrade de plan`);

        // Simular proceso de upgrade
        console.log(`  ⬆️ Iniciando proceso de mejora de plan para ${user.phoneNumber}...`);
        session.upgradingPlan = false;

        return true; // Mensaje completamente manejado
    }
}

// Configurar y probar
async function testFlowManager() {
    console.log('🚀 INICIANDO PRUEBA DEL FLOWMANAGER CORREGIDO\n');

    const manager = new ConversationFlowManager(MockMessageService);

    // Registrar flujos en el orden correcto
    manager.registerFlow(new ClientMenuFlow());
    manager.registerFlow(new IPDiagnosticFlow());
    manager.registerFlow(new TicketCreationFlow());
    manager.registerFlow(new PlanUpgradeFlow());

    console.log('\n');

    // Casos de prueba
    const testCases = [
        {
            name: 'Test de Conexión',
            user: { phoneNumber: '+573001234567', isRegistered: true },
            message: '📡 Test de Conexión',
            session: {}
        },
        {
            name: 'Soporte Técnico',
            user: { phoneNumber: '+573001234567', isRegistered: true },
            message: '🔧 Soporte Técnico',
            session: {}
        },
        {
            name: 'Mejorar Plan',
            user: { phoneNumber: '+573001234567', isRegistered: true },
            message: '⬆️ Mejorar Plan',
            session: {}
        },
        {
            name: 'Comando ping directo',
            user: { phoneNumber: '+573001234567', isRegistered: true },
            message: 'ping',
            session: {}
        },
        {
            name: 'Mensaje no reconocido',
            user: { phoneNumber: '+573001234567', isRegistered: true },
            message: 'mensaje aleatorio que no debería ser reconocido',
            session: {}
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 PROBANDO: ${testCase.name}`);
        console.log(`📤 Mensaje: "${testCase.message}"`);
        console.log(`${'='.repeat(60)}`);

        const sessionCopy = { ...testCase.session };

        try {
            const result = await manager.processMessage(testCase.user, testCase.message, sessionCopy);

            console.log(`\n📊 RESULTADO: ${result ? '✅ MANEJADO' : '❌ NO MANEJADO'}`);
            console.log(`📋 Estado de sesión final:`, sessionCopy);

            if (!result) {
                console.log(`❗ PROBLEMA: El mensaje "${testCase.message}" NO fue manejado por ningún flujo`);
            }
        } catch (error) {
            console.error(`❌ ERROR durante la prueba:`, error);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 PRUEBAS COMPLETADAS');
    console.log(`${'='.repeat(60)}\n`);
}

// Ejecutar las pruebas
testFlowManager().catch(console.error);

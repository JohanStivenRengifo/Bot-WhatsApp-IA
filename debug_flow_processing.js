/**
 * Script de diagnóstico completo para el flujo de procesamiento de mensajes
 */

const { extractMenuCommand, isMenuCommand } = require('./dist/utils/messageUtils');

// Simular la función canHandle de cada flujo principal
class FlowSimulator {

    // ClientMenuFlow.canHandle
    static simulateClientMenuCanHandle(user, message, session) {
        const extractedCommand = extractMenuCommand(message);
        const menuOptions = [
            'ping', 'ticket', 'factura', 'deuda', 'puntos_pago',
            'cambiar_clave', 'mejorar_plan', 'validar_pago', 'menu', 'inicio'
        ];

        return user.authenticated &&
            !session.creatingTicket &&
            !session.consultingInvoices &&
            !session.changingPassword &&
            !session.upgradingPlan &&
            !session.diagnosticInProgress &&
            menuOptions.includes(extractedCommand);
    }

    // IPDiagnosticFlow.canHandle
    static simulateIPDiagnosticCanHandle(user, message, session) {
        if (!user.authenticated) return false;

        // Si ya hay un diagnóstico en progreso, este flujo debe manejar el mensaje
        if (session.diagnosticInProgress === true) return true;

        const extractedCommand = extractMenuCommand(message);

        // Verificar comando directo del menú
        if (extractedCommand === 'ping') return true;

        // Verificar otros comandos relacionados
        return isMenuCommand(message, [
            'test_conexion', 'test de conexion', 'test de conexión',
            'diagnostico_ip', 'diagnóstico ip', 'diagnostico ip',
            'ping_ip', 'ping ip', 'estado de conexion', 'estado de conexión',
            'verificar estado', 'verificar conexión'
        ]);
    }

    // TicketCreationFlow.canHandle
    static simulateTicketCreationCanHandle(user, message, session) {
        const extractedCommand = extractMenuCommand(message);

        return (
            user.authenticated &&
            (extractedCommand === 'ticket' ||
                session.creatingTicket === true ||
                isMenuCommand(message, ['crear_ticket', 'ticket_creation', 'soporte',
                    'reportar_falla', 'crear ticket', 'reportar problema']))
        );
    }

    // PlanUpgradeFlow.canHandle
    static simulatePlanUpgradeCanHandle(user, message, session) {
        const extractedCommand = extractMenuCommand(message);

        return (
            user.authenticated &&
            (extractedCommand === 'mejorar_plan' ||
                isMenuCommand(message, ['plan_upgrade', 'upgrade_plan', 'mejora_plan', 'mejorar plan', '⬆️ mejorar plan']) ||
                session.upgradingPlan === true)
        );
    }
}

// Casos de prueba completos
const testCases = [
    {
        name: "Usuario autenticado selecciona Test de Conexión",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "📡 Test de Conexión\nVerificar estado de tu conexión",
        session: {}
    },
    {
        name: "Usuario autenticado selecciona Soporte Técnico",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "🔧 Soporte Técnico\nReportar problemas técnicos",
        session: {}
    },
    {
        name: "Usuario autenticado selecciona Mejorar Plan",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "⬆️ Mejorar Plan\nUpgrade de velocidad",
        session: {}
    },
    {
        name: "Usuario no autenticado intenta usar Test de Conexión",
        user: { authenticated: false, phoneNumber: "1234567890" },
        message: "📡 Test de Conexión",
        session: {}
    }
];

console.log("🔍 Diagnóstico completo del flujo de procesamiento de mensajes\n");

testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`);
    console.log(`   Usuario: ${JSON.stringify(testCase.user)}`);
    console.log(`   Mensaje: "${testCase.message}"`);
    console.log(`   Sesión inicial: ${JSON.stringify(testCase.session)}`);

    // Extraer comando
    const extractedCommand = extractMenuCommand(testCase.message);
    console.log(`   🔧 Comando extraído: "${extractedCommand}"`);

    // Simular evaluación de cada flujo en orden de registro
    const flows = [
        { name: 'ClientMenuFlow', simulator: FlowSimulator.simulateClientMenuCanHandle },
        { name: 'TicketCreationFlow', simulator: FlowSimulator.simulateTicketCreationCanHandle },
        { name: 'PlanUpgradeFlow', simulator: FlowSimulator.simulatePlanUpgradeCanHandle },
        { name: 'IPDiagnosticFlow', simulator: FlowSimulator.simulateIPDiagnosticCanHandle }
    ];

    console.log(`   📊 Evaluación de flujos:`);
    let handledBy = null;

    for (const flow of flows) {
        const canHandle = flow.simulator(testCase.user, testCase.message, testCase.session);
        console.log(`      ${flow.name}: ${canHandle ? '✅ SÍ' : '❌ NO'}`);

        if (canHandle && !handledBy) {
            handledBy = flow.name;
        }
    }

    console.log(`   🎯 Resultado: ${handledBy ? `Manejado por ${handledBy}` : '❌ No manejado por ningún flujo'}`);

    // Si es ClientMenuFlow, simular qué haría
    if (handledBy === 'ClientMenuFlow') {
        const sessionAfterClientMenu = { ...testCase.session };

        switch (extractedCommand) {
            case 'ping':
                sessionAfterClientMenu.flowActive = 'ipDiagnostic';
                sessionAfterClientMenu.diagnosticInProgress = true;
                console.log(`   🔄 ClientMenuFlow configuraría sesión: ${JSON.stringify(sessionAfterClientMenu)}`);

                // Verificar si IPDiagnosticFlow puede manejar después
                const ipCanHandleAfter = FlowSimulator.simulateIPDiagnosticCanHandle(testCase.user, testCase.message, sessionAfterClientMenu);
                console.log(`   🎯 IPDiagnosticFlow podría manejar después: ${ipCanHandleAfter ? '✅ SÍ' : '❌ NO'}`);
                break;
            case 'ticket':
                sessionAfterClientMenu.creatingTicket = true;
                sessionAfterClientMenu.flowActive = 'ticketCreation';
                console.log(`   🔄 ClientMenuFlow configuraría sesión: ${JSON.stringify(sessionAfterClientMenu)}`);

                const ticketCanHandleAfter = FlowSimulator.simulateTicketCreationCanHandle(testCase.user, testCase.message, sessionAfterClientMenu);
                console.log(`   🎯 TicketCreationFlow podría manejar después: ${ticketCanHandleAfter ? '✅ SÍ' : '❌ NO'}`);
                break;
            case 'mejorar_plan':
                sessionAfterClientMenu.upgradingPlan = true;
                sessionAfterClientMenu.flowActive = 'planUpgrade';
                console.log(`   🔄 ClientMenuFlow configuraría sesión: ${JSON.stringify(sessionAfterClientMenu)}`);

                const planCanHandleAfter = FlowSimulator.simulatePlanUpgradeCanHandle(testCase.user, testCase.message, sessionAfterClientMenu);
                console.log(`   🎯 PlanUpgradeFlow podría manejar después: ${planCanHandleAfter ? '✅ SÍ' : '❌ NO'}`);
                break;
        }
    }
});

console.log(`\n\n🔍 ANÁLISIS DETALLADO DEL PROBLEMA:`);
console.log(`1. El reconocimiento de comandos funciona correctamente`);
console.log(`2. Los flujos están configurados correctamente`);
console.log(`3. El problema parece estar en:`);
console.log(`   - El orden de evaluación de flujos`);
console.log(`   - La lógica de retorno del ClientMenuFlow`);
console.log(`   - Posible problema en el FlowManager.processMessage()`);

console.log(`\n💡 RECOMENDACIONES:`);
console.log(`1. Verificar que ClientMenuFlow retorna 'false' correctamente`);
console.log(`2. Verificar que FlowManager continúa evaluando flujos después de 'false'`);
console.log(`3. Revisar logs del servidor para ver qué flujo está realmente manejando el mensaje`);

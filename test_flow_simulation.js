/**
 * Script de simulación completa de flujos problemáticos
 */

const { extractMenuCommand, isMenuCommand } = require('./dist/utils/messageUtils');

// Simulamos las funciones de verificación de flujos
function simulateIPDiagnosticFlow(user, message, session) {
    if (!user.authenticated) return false;
    
    if (session.diagnosticInProgress === true) return true;
    
    const extractedCommand = extractMenuCommand(message);
    
    if (extractedCommand === 'ping') return true;
    
    return isMenuCommand(message, [
        'test_conexion', 'test de conexion', 'test de conexión',
        'diagnostico_ip', 'diagnóstico ip', 'diagnostico ip',
        'ping_ip', 'ping ip', 'estado de conexion', 'estado de conexión',
        'verificar estado', 'verificar conexión'
    ]);
}

function simulateTicketCreationFlow(user, message, session) {
    const extractedCommand = extractMenuCommand(message);
    
    return (
        user.authenticated &&
        (extractedCommand === 'ticket' ||
            session.creatingTicket === true ||
            isMenuCommand(message, ['crear_ticket', 'ticket_creation', 'soporte',
                'reportar_falla', 'crear ticket', 'reportar problema']))
    );
}

function simulatePlanUpgradeFlow(user, message, session) {
    const extractedCommand = extractMenuCommand(message);
    
    return (
        user.authenticated &&
        (extractedCommand === 'mejorar_plan' ||
            isMenuCommand(message, ['plan_upgrade', 'upgrade_plan', 'mejora_plan', 'mejorar plan', '⬆️ mejorar plan']) ||
            session.upgradingPlan === true)
    );
}

// Casos de prueba basados en el log de errores
const conversationTests = [
    {
        description: "Usuario autenticado selecciona Test de Conexión",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "📡 Test de Conexión",
        session: {},
        expectedFlows: {
            IPDiagnostic: true,
            TicketCreation: false,
            PlanUpgrade: false
        }
    },
    {
        description: "Usuario autenticado selecciona Soporte Técnico",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "🔧 Soporte Técnico", 
        session: {},
        expectedFlows: {
            IPDiagnostic: false,
            TicketCreation: true,
            PlanUpgrade: false
        }
    },
    {
        description: "Usuario autenticado selecciona Mejorar Plan",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "⬆️ Mejorar Plan",
        session: {},
        expectedFlows: {
            IPDiagnostic: false,
            TicketCreation: false,
            PlanUpgrade: true
        }
    },
    {
        description: "Usuario en proceso de crear ticket responde",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "sin internet",
        session: { creatingTicket: true },
        expectedFlows: {
            IPDiagnostic: false,
            TicketCreation: true,
            PlanUpgrade: false
        }
    },
    {
        description: "Usuario en proceso de diagnóstico recibe respuesta",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "cualquier cosa",
        session: { diagnosticInProgress: true },
        expectedFlows: {
            IPDiagnostic: true,
            TicketCreation: false,
            PlanUpgrade: false
        }
    }
];

console.log("🔍 Simulando flujos de conversación...\n");

let totalTests = 0;
let passedTests = 0;

conversationTests.forEach((test, index) => {
    console.log(`Prueba ${index + 1}: ${test.description}`);
    console.log(`  Mensaje: "${test.message}"`);
    console.log(`  Sesión: ${JSON.stringify(test.session)}`);
    
    const results = {
        IPDiagnostic: simulateIPDiagnosticFlow(test.user, test.message, test.session),
        TicketCreation: simulateTicketCreationFlow(test.user, test.message, test.session),
        PlanUpgrade: simulatePlanUpgradeFlow(test.user, test.message, test.session)
    };
    
    console.log(`  Resultados:`);
    let testPassed = true;
    
    Object.keys(test.expectedFlows).forEach(flow => {
        const expected = test.expectedFlows[flow];
        const actual = results[flow];
        const correct = expected === actual;
        
        console.log(`    ${flow}: ${actual} ${correct ? '✅' : '❌'} (esperado: ${expected})`);
        
        if (!correct) {
            testPassed = false;
        }
        totalTests++;
    });
    
    console.log(`  Estado: ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);
    
    if (testPassed) {
        passedTests += Object.keys(test.expectedFlows).length;
    }
});

console.log(`📊 Resumen de simulación:`);
console.log(`✅ Verificaciones exitosas: ${passedTests}`);
console.log(`❌ Verificaciones fallidas: ${totalTests - passedTests}`);
console.log(`📈 Porcentaje de éxito: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
    console.log("\n🎉 Todos los flujos están funcionando correctamente!");
} else {
    console.log("\n⚠️  Algunos flujos necesitan revisión.");
}

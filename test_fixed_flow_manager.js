/**
 * Simulación del nuevo comportamiento del FlowManager corregido
 */

const { extractMenuCommand, isMenuCommand } = require('./dist/utils/messageUtils');

// Simular el nuevo comportamiento del FlowManager.processMessage
class FixedFlowManager {
    constructor() {
        this.flows = [
            {
                name: 'InitialSelectionFlow',
                canHandle: () => false,
                handle: () => true
            },
            {
                name: 'PrivacyPolicyFlow',
                canHandle: () => false,
                handle: () => true
            },
            {
                name: 'AuthenticationFlow',
                canHandle: () => false,
                handle: () => true
            },
            {
                name: 'ClientMenuFlow',
                canHandle: (user, message, session) => {
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
                },
                handle: (user, message, session) => {
                    const extractedCommand = extractMenuCommand(message);

                    // Limpiar estados previos
                    this.clearSessionFlags(session);

                    switch (extractedCommand) {
                        case 'ping':
                            session.flowActive = 'ipDiagnostic';
                            session.diagnosticInProgress = true;
                            return false; // Permitir que IPDiagnosticFlow maneje
                        case 'ticket':
                            session.creatingTicket = true;
                            session.flowActive = 'ticketCreation';
                            return false; // Permitir que TicketCreationFlow maneje
                        case 'mejorar_plan':
                            session.upgradingPlan = true;
                            session.flowActive = 'planUpgrade';
                            return false; // Permitir que PlanUpgradeFlow maneje
                        case 'menu':
                        case 'inicio':
                            // Manejar menú directamente
                            console.log('   🏠 ClientMenuFlow enviaría menú principal');
                            return true;
                        default:
                            return false;
                    }
                }
            },
            {
                name: 'TicketCreationFlow',
                canHandle: (user, message, session) => {
                    const extractedCommand = extractMenuCommand(message);

                    return (
                        user.authenticated &&
                        (extractedCommand === 'ticket' ||
                            session.creatingTicket === true ||
                            isMenuCommand(message, ['crear_ticket', 'ticket_creation', 'soporte',
                                'reportar_falla', 'crear ticket', 'reportar problema']))
                    );
                },
                handle: (user, message, session) => {
                    console.log('   🎫 TicketCreationFlow procesaría creación de ticket');
                    return true;
                }
            },
            {
                name: 'PlanUpgradeFlow',
                canHandle: (user, message, session) => {
                    const extractedCommand = extractMenuCommand(message);

                    return (
                        user.authenticated &&
                        (extractedCommand === 'mejorar_plan' ||
                            isMenuCommand(message, ['plan_upgrade', 'upgrade_plan', 'mejora_plan', 'mejorar plan', '⬆️ mejorar plan']) ||
                            session.upgradingPlan === true)
                    );
                },
                handle: (user, message, session) => {
                    console.log('   ⬆️ PlanUpgradeFlow procesaría mejora de plan');
                    return true;
                }
            },
            {
                name: 'IPDiagnosticFlow',
                canHandle: (user, message, session) => {
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
                },
                handle: (user, message, session) => {
                    console.log('   📡 IPDiagnosticFlow procesaría diagnóstico de conexión');
                    return true;
                }
            }
        ];
    }

    clearSessionFlags(session) {
        session.flowActive = '';
        session.creatingTicket = false;
        session.changingPassword = false;
        session.upgradingPlan = false;
        session.consultingInvoices = false;
        session.diagnosticInProgress = false;
    }

    async processMessage(user, message, session) {
        const command = extractMenuCommand(message);

        // Manejar comandos globales
        if (command === 'menu' || command === 'inicio') {
            console.log('   🏠 Comando global de menú detectado');
            return true;
        }

        if (command === 'finalizar') {
            console.log('   👋 Comando global de finalización detectado');
            return true;
        }

        // Verificar cada flujo en orden
        for (const flow of this.flows) {
            try {
                // Comprobar si el flujo puede manejar este mensaje
                if (await flow.canHandle(user, message, session)) {
                    console.log(`   🔍 Flujo ${flow.name} puede manejar el mensaje`);
                    // Si el flujo puede manejar el mensaje, procesarlo
                    const handled = await flow.handle(user, message, session);

                    // Si el flujo manejó completamente el mensaje, terminar procesamiento
                    if (handled) {
                        console.log(`   ✅ Mensaje completamente manejado por: ${flow.name}`);
                        return true;
                    }

                    // Si el flujo retornó false, continuar con otros flujos
                    console.log(`   🔄 Flujo ${flow.name} configuró estado pero delegó manejo`);
                }
            } catch (error) {
                console.error(`   ❌ Error en flujo ${flow.name}:`, error);
            }
        }

        // Ningún flujo pudo manejar el mensaje
        console.log('   ❌ Ningún flujo manejó el mensaje');
        return false;
    }
}

// Casos de prueba
const testCases = [
    {
        name: "📡 Test de Conexión",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "📡 Test de Conexión\nVerificar estado de tu conexión",
        session: {}
    },
    {
        name: "🔧 Soporte Técnico",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "🔧 Soporte Técnico\nReportar problemas técnicos",
        session: {}
    },
    {
        name: "⬆️ Mejorar Plan",
        user: { authenticated: true, phoneNumber: "1234567890" },
        message: "⬆️ Mejorar Plan\nUpgrade de velocidad",
        session: {}
    }
];

console.log("🔧 Simulación del FlowManager corregido\n");

const manager = new FixedFlowManager();

for (const testCase of testCases) {
    console.log(`\n🧪 Prueba: ${testCase.name}`);
    console.log(`   Mensaje: "${testCase.message}"`);
    console.log(`   Usuario autenticado: ${testCase.user.authenticated}`);
    console.log(`   Sesión inicial: ${JSON.stringify(testCase.session)}`);

    const sessionCopy = { ...testCase.session };
    const result = await manager.processMessage(testCase.user, testCase.message, sessionCopy);

    console.log(`   📊 Resultado final: ${result ? '✅ MANEJADO' : '❌ NO MANEJADO'}`);
    console.log(`   📋 Sesión final: ${JSON.stringify(sessionCopy)}`);
}

console.log(`\n\n🎉 ANÁLISIS:`);
console.log(`Con la corrección del FlowManager, todos los mensajes deberían procesarse correctamente.`);
console.log(`El ClientMenuFlow configura el estado y luego permite que el flujo específico maneje el mensaje.`);

/**
 * Script de prueba para verificar el reconocimiento de comandos problemáticos
 */

const { extractMenuCommand } = require('./dist/utils/messageUtils');

// Casos de prueba basados en el log de errores
const testCases = [
    // Caso 1: Test de Conexión
    {
        input: "📡 Test de Conexión",
        expected: "ping",
        description: "Botón del menú principal para test de conexión"
    },
    {
        input: "📡 Test de Conexion",
        expected: "ping",
        description: "Variante sin tilde"
    },
    {
        input: "test de conexión",
        expected: "ping",
        description: "Comando directo sin emoji"
    },

    // Caso 2: Soporte Técnico  
    {
        input: "🔧 Soporte Técnico",
        expected: "ticket",
        description: "Botón del menú principal para soporte técnico"
    },
    {
        input: "🔧 Soporte Tecnico",
        expected: "ticket",
        description: "Variante sin tilde"
    },
    {
        input: "soporte técnico",
        expected: "ticket",
        description: "Comando directo sin emoji"
    },

    // Caso 3: Mejorar Plan
    {
        input: "⬆️ Mejorar Plan",
        expected: "mejorar_plan",
        description: "Botón del menú principal para mejorar plan"
    },
    {
        input: "⬆ Mejorar Plan",
        expected: "mejorar_plan",
        description: "Variante con emoji simple"
    },
    {
        input: "mejorar plan",
        expected: "mejorar_plan",
        description: "Comando directo sin emoji"
    }
];

console.log("🔍 Verificando reconocimiento de comandos...\n");

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    const result = extractMenuCommand(testCase.input);
    const isCorrect = result === testCase.expected;

    console.log(`Prueba ${index + 1}: ${testCase.description}`);
    console.log(`  Input: "${testCase.input}"`);
    console.log(`  Esperado: "${testCase.expected}"`);
    console.log(`  Obtenido: "${result}"`);
    console.log(`  Resultado: ${isCorrect ? '✅ PASS' : '❌ FAIL'}\n`);

    if (isCorrect) {
        passed++;
    } else {
        failed++;
    }
});

console.log(`\n📊 Resumen de pruebas:`);
console.log(`✅ Exitosas: ${passed}`);
console.log(`❌ Fallidas: ${failed}`);
console.log(`📈 Porcentaje de éxito: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed > 0) {
    console.log("\n⚠️  Algunos comandos no se reconocen correctamente. Revisar implementación.");
    process.exit(1);
} else {
    console.log("\n🎉 Todos los comandos se reconocen correctamente!");
    process.exit(0);
}

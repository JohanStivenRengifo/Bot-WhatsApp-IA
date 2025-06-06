/**
 * Prueba específica para el mensaje que está fallando en el log
 */

const { extractMenuCommand } = require('./dist/utils/messageUtils');

// El mensaje exacto del log que está fallando
const problematicMessage = "📡 Test de Conexión\nVerificar estado de tu conexión";

console.log("🔍 Probando mensaje específico del log...\n");

console.log(`Mensaje a probar:`);
console.log(`"${problematicMessage}"`);
console.log(`\nCaracteres por línea:`);
const lines = problematicMessage.split('\n');
lines.forEach((line, index) => {
    console.log(`  Línea ${index + 1}: "${line}" (${line.length} chars)`);
});

const result = extractMenuCommand(problematicMessage);

console.log(`\nResultado del extractMenuCommand: "${result}"`);
console.log(`¿Es 'ping'? ${result === 'ping' ? '✅ SÍ' : '❌ NO'}`);

// También probar el mensaje normalizado paso a paso
console.log(`\n🔬 Análisis paso a paso:`);
const normalizedMessage = problematicMessage.toLowerCase().trim();
console.log(`1. Mensaje normalizado: "${normalizedMessage}"`);

// Verificar si contiene patrones específicos
const patterns = [
    'test de conexión',
    'test de conexion',
    'verificar estado',
    'ping',
    '📡 test de conexión'
];

console.log(`\n2. Verificando patrones:`);
patterns.forEach(pattern => {
    const contains = normalizedMessage.includes(pattern);
    console.log(`   "${pattern}": ${contains ? '✅ SÍ' : '❌ NO'}`);
});

// Verificar con emojis removidos
const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
const textWithoutEmojis = normalizedMessage.replace(emojiPattern, '').trim();
console.log(`\n3. Sin emojis: "${textWithoutEmojis}"`);

const titlePart = textWithoutEmojis.split('\n')[0].trim();
console.log(`4. Solo título: "${titlePart}"`);

console.log(`\n5. Verificando título contra patrones:`);
patterns.forEach(pattern => {
    const titleContains = titlePart.includes(pattern);
    const patternContains = pattern.includes(titlePart);
    console.log(`   "${pattern}": título contiene=${titleContains ? '✅' : '❌'}, patrón contiene título=${patternContains ? '✅' : '❌'}`);
});

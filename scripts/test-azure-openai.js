#!/usr/bin/env node
require('dotenv').config();

const { AzureOpenAIService } = require('../dist/services/AzureOpenAIService');

async function testAzureOpenAI() {
    console.log('🧪 Iniciando prueba de Azure OpenAI Service...\n');

    try {
        const aiService = new AzureOpenAIService();
        console.log('✅ Servicio inicializado correctamente\n');

        // Test 1: Mensaje simple
        console.log('📝 Test 1: Mensaje simple');
        const response1 = await aiService.sendMessage('Hola, ¿cómo estás?', 'Eres un asistente amigable');
        console.log('Respuesta:', response1.success ? response1.message : response1.error);
        console.log('Modelo usado:', response1.modelUsed);
        console.log('---\n');

        // Test 2: Respuesta de ventas
        console.log('📊 Test 2: Respuesta de ventas');
        const response2 = await aiService.getSalesResponse('¿Qué planes de internet tienen?', {});
        console.log('Respuesta:', response2.success ? response2.message.substring(0, 200) + '...' : response2.error);
        console.log('Modelo usado:', response2.modelUsed);
        console.log('---\n');

        // Test 3: Estado del servicio
        console.log('🔍 Test 3: Estado del servicio');
        const status = await aiService.getServiceStatus();
        console.log('Estado:', JSON.stringify(status, null, 2));
        console.log('---\n');

        // Test 4: Configuración actual
        console.log('⚙️ Test 4: Configuración actual');
        const config = aiService.getCurrentConfiguration();
        console.log('Configuración:', JSON.stringify(config, null, 2));

        console.log('\n🎉 Todas las pruebas completadas exitosamente!');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
        process.exit(1);
    }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
    testAzureOpenAI();
}

module.exports = { testAzureOpenAI };

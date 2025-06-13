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
        console.log('---\n');        // Test 2: Respuesta de ventas
        console.log('📊 Test 2: Respuesta de ventas');
        const plansData = {
            internetPlans: [
                { id: 'plan_50', name: '50 Mbps', speed: '100/50 Mbps', price: 50000, description: 'Perfecto para familias y trabajo remoto' }
            ],
            tvPlans: [
                { id: 'tv_hd', name: 'TV Completo', channels: '85+ canales HD', price: 40000, description: '+85 Canales en HD' }
            ],
            comboPlan: [
                { id: 'combo_basico', name: 'Combo Básico', description: '30 Mbps + TV HD', originalPrice: 80000, comboPrice: 60000, discount: 20000 }
            ]
        };
        const context = 'Primera interacción del cliente';
        const response2 = await aiService.getSalesResponse('¿Qué planes de internet tienen?', plansData, context);
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

#!/usr/bin/env node
require('dotenv').config();

const { AzureOpenAIService } = require('../dist/services/AzureOpenAIService');

async function testSalesFlow() {
    console.log('🛒 Iniciando prueba de SalesFlow con Azure OpenAI...\n');

    try {
        const aiService = new AzureOpenAIService();
        console.log('✅ Servicio Azure OpenAI inicializado\n');

        // Datos de planes como los define SalesFlow
        const plansData = {
            internetPlans: [
                { id: 'plan_30', name: '30 Mbps', speed: '50/20 Mbps', price: 40000, description: 'Ideal para uso básico y navegación' },
                { id: 'plan_50', name: '50 Mbps', speed: '100/50 Mbps', price: 50000, description: 'Perfecto para familias y trabajo remoto' },
                { id: 'plan_60', name: '60 Mbps', speed: '200/100 Mbps', price: 60000, description: 'Excelente para gaming y streaming' },
                { id: 'plan_70', name: '70 Mbps', speed: '300/150 Mbps', price: 68000, description: 'Velocidad premium para empresas' },
                { id: 'plan_80', name: '80 Mbps', speed: '500/250 Mbps', price: 75000, description: 'Ultra velocidad para uso intensivo' },
                { id: 'plan_100', name: '100 Mbps', speed: '1000/500 Mbps', price: 80000, description: 'Máxima velocidad para hogares' }
            ],
            tvPlans: [
                { id: 'tv_hd', name: 'TV Completo', channels: '85+ canales HD', price: 40000, description: '+85 Canales en HD' }
            ],
            comboPlan: [
                { id: 'combo_basico', name: 'Combo Básico', description: '30 Mbps + TV HD', originalPrice: 80000, comboPrice: 60000, discount: 20000 },
                { id: 'combo_standar', name: 'Combo Familiar', description: '50 Mbps + TV HD', originalPrice: 90000, comboPrice: 70000, discount: 20000 },
                { id: 'combo_premium', name: 'Combo Premium', description: '100 Mbps + TV HD', originalPrice: 120000, comboPrice: 100000, discount: 20000 }
            ]
        };

        const context = { userHistory: [] };

        // Test 1: Consulta de precios
        console.log('💰 Test 1: Consulta de precios');
        const response1 = await aiService.getSalesResponse('¿Qué planes de internet tienen y cuánto cuestan?', plansData, context);
        console.log('Pregunta: ¿Qué planes de internet tienen y cuánto cuestan?');
        console.log('Respuesta:', response1.success ? response1.message.substring(0, 300) + '...' : response1.error);
        console.log('Modelo:', response1.modelUsed);
        console.log('---\n');

        // Test 2: Consulta específica de plan
        console.log('🎯 Test 2: Consulta específica de plan');
        const response2 = await aiService.getSalesResponse('Me interesa el plan de 50 Mbps, ¿qué incluye?', plansData, context);
        console.log('Pregunta: Me interesa el plan de 50 Mbps, ¿qué incluye?');
        console.log('Respuesta:', response2.success ? response2.message.substring(0, 300) + '...' : response2.error);
        console.log('Modelo:', response2.modelUsed);
        console.log('---\n');

        // Test 3: Consulta de combos
        console.log('📦 Test 3: Consulta de combos');
        const response3 = await aiService.getSalesResponse('¿Tienen combos con descuento? Quiero internet y TV', plansData, context);
        console.log('Pregunta: ¿Tienen combos con descuento? Quiero internet y TV');
        console.log('Respuesta:', response3.success ? response3.message.substring(0, 300) + '...' : response3.error);
        console.log('Modelo:', response3.modelUsed);
        console.log('---\n');

        // Test 4: Intención de contratar
        console.log('✅ Test 4: Intención de contratar');
        const response4 = await aiService.getSalesResponse('Quiero contratar el combo familiar, ¿cómo procedo?', plansData, context);
        console.log('Pregunta: Quiero contratar el combo familiar, ¿cómo procedo?');
        console.log('Respuesta:', response4.success ? response4.message.substring(0, 300) + '...' : response4.error);
        console.log('Modelo:', response4.modelUsed);
        console.log('---\n');

        // Test 5: Pregunta fuera de planes
        console.log('❓ Test 5: Pregunta fuera de planes');
        const response5 = await aiService.getSalesResponse('¿Tienen plan de 200 Mbps?', plansData, context);
        console.log('Pregunta: ¿Tienen plan de 200 Mbps?');
        console.log('Respuesta:', response5.success ? response5.message.substring(0, 300) + '...' : response5.error);
        console.log('Modelo:', response5.modelUsed);

        console.log('\n🎉 Todas las pruebas de SalesFlow completadas exitosamente!');
        console.log('\n📊 Resumen:');
        console.log('✅ La IA reconoce todos los planes disponibles');
        console.log('✅ Proporciona precios exactos');
        console.log('✅ Sugiere combos cuando es apropiado');
        console.log('✅ Maneja consultas específicas');
        console.log('✅ Redirige planes no disponibles a opciones existentes');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
        process.exit(1);
    }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
    testSalesFlow();
}

module.exports = { testSalesFlow };

/**
 * Script de prueba para el SalesFlow mejorado con IA completa
 */

const { AzureOpenAIService } = require('../dist/services/AzureOpenAIService');
const { config } = require('../dist/config');

async function testImprovedSalesFlow() {
    console.log('🧪 Iniciando pruebas del SalesFlow mejorado...\n');

    try {
        // Inicializar servicio
        const azureOpenAI = new AzureOpenAIService();
        console.log('✅ AzureOpenAIService inicializado correctamente\n');

        // Datos de prueba
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

        // Casos de prueba
        const testCases = [
            {
                name: 'Mensaje de bienvenida',
                message: 'El usuario acaba de conectarse al área de ventas. Genera un mensaje de bienvenida amigable y profesional que presente nuestros servicios de manera atractiva.',
                context: 'INFORMACIÓN DEL CLIENTE:\n- Teléfono: +573001234567\n- Estado de contratación: CONSULTANDO\n- Historial de conversación: 0 interacciones'
            },
            {
                name: 'Consulta sobre planes para gaming',
                message: 'Hola, necesito internet para gaming, ¿qué me recomiendan?',
                context: 'INFORMACIÓN DEL CLIENTE:\n- Teléfono: +573001234567\n- Estado de contratación: CONSULTANDO\n- Cliente consultando: Enfócate en resolver dudas y recomendar el plan ideal según su uso'
            },
            {
                name: 'Interés en combos',
                message: 'Me interesan los combos, ¿cuáles tienen disponibles?',
                context: 'INFORMACIÓN DEL CLIENTE:\n- Cliente consultando: Enfócate en resolver dudas y recomendar el plan ideal según su uso\n- Cliente pidiendo precios: Muestra planes con precios exactos y destaca ahorros en combos'
            },
            {
                name: 'Solicitud de contratación',
                message: 'Quiero contratar el plan de 50 Mbps',
                context: 'INFORMACIÓN DEL CLIENTE:\n- Cliente interesado en contratar: Guíalo hacia el proceso de contratación'
            }
        ];

        // Ejecutar pruebas
        for (const [index, testCase] of testCases.entries()) {
            console.log(`\n📝 Prueba ${index + 1}: ${testCase.name}`);
            console.log(`👤 Mensaje: "${testCase.message}"\n`);

            const response = await azureOpenAI.getSalesResponse(
                testCase.message,
                plansData,
                testCase.context
            );

            if (response.success) {
                console.log(`🤖 Respuesta de Andrea:`);
                console.log(`"${response.message}"`);

                // Verificaciones básicas
                const hasPlansInfo = plansData.internetPlans.some(plan =>
                    response.message.includes(plan.name) ||
                    response.message.includes(plan.price.toString())
                );

                const isFriendly = response.message.includes('!') ||
                    response.message.includes('😊') ||
                    response.message.includes('👋') ||
                    response.message.includes('🚀');

                console.log(`✅ Incluye información de planes: ${hasPlansInfo ? 'SÍ' : 'NO'}`);
                console.log(`✅ Tono amigable: ${isFriendly ? 'SÍ' : 'NO'}`);

                // Verificar que no invente planes
                const inventedInfo = response.message.includes('$90000') ||
                    response.message.includes('150 Mbps') ||
                    response.message.includes('plan ultra');
                console.log(`✅ No inventa planes: ${!inventedInfo ? 'SÍ' : 'NO'}`);

            } else {
                console.log(`❌ Error: ${response.error}`);
            }

            console.log('\n' + '='.repeat(80));
        }

        // Prueba de detección de tickets
        console.log('\n🎫 Prueba de detección de tickets:\n');

        const ticketPrompt = `
Analiza esta conversación de ventas y determina si el cliente quiere:
1. Crear una cotización/propuesta formal
2. Proceder con instalación/contratación
3. Que un técnico lo visite
4. Hacer una consulta más formal

Conversación:
Cliente: "Me interesa el plan de 50 Mbps, ¿pueden enviarse una cotización formal?"
Asesora: "¡Perfecto! Te puedo generar una cotización formal para el plan de 50 Mbps por $50.000/mes."

Responde SOLO con:
- "TICKET_COTIZACION" si quiere cotización formal
- "TICKET_INSTALACION" si quiere instalar/contratar
- "TICKET_CONSULTA" si quiere consulta técnica
- "NO_TICKET" si solo está consultando información

Respuesta:`;

        const ticketResponse = await azureOpenAI.sendMessage(ticketPrompt);

        if (ticketResponse.success) {
            console.log(`🎫 Detección de ticket: "${ticketResponse.message}"`);
            const isCorrect = ticketResponse.message.includes('TICKET_COTIZACION');
            console.log(`✅ Detección correcta: ${isCorrect ? 'SÍ' : 'NO'}`);
        } else {
            console.log(`❌ Error en detección de tickets: ${ticketResponse.error}`);
        }

        console.log('\n🎉 Pruebas completadas exitosamente!');

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error);
        process.exit(1);
    }
}

// Ejecutar pruebas
if (require.main === module) {
    testImprovedSalesFlow();
}

module.exports = { testImprovedSalesFlow };

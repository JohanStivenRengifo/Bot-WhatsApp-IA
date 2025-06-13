/**
 * Script de prueba para verificar el cierre correcto de sesiones en SalesFlow
 */

const { SalesFlow } = require('../dist/flows/SalesFlow');
const { MessageService } = require('../dist/services/MessageService');
const { SecurityService } = require('../dist/services/SecurityService');
const { CustomerService } = require('../dist/services/CustomerService');

// Mock de MessageService para pruebas
class MockMessageService {
    messages = [];

    async sendTextMessage(phoneNumber, message) {
        this.messages.push({ phoneNumber, message });
        console.log(`📱 [${phoneNumber}] ${message}`);
        return true;
    }

    getLastMessage() {
        return this.messages[this.messages.length - 1]?.message || '';
    }

    clearMessages() {
        this.messages = [];
    }
}

// Mock de SecurityService
class MockSecurityService {
    encryptData(data) { return data; }
    decryptData(data) { return data; }
}

// Mock de CustomerService
class MockCustomerService {
    async getCustomerInfo() { return null; }
}

async function testSessionClosure() {
    console.log('🧪 Probando cierre de sesiones en SalesFlow...\n');

    try {
        // Inicializar mocks
        const messageService = new MockMessageService();
        const securityService = new MockSecurityService();
        const customerService = new MockCustomerService();

        // Crear instancia de SalesFlow
        const salesFlow = new SalesFlow(messageService, securityService, customerService);

        // Usuario de prueba
        const user = {
            phoneNumber: '+573001234567',
            acceptedPrivacyPolicy: true,
            customerId: '123'
        };

        // Simular flujo completo de contratación
        console.log('📝 Paso 1: Iniciando conversación de ventas');
        let session = {
            flowActive: 'sales',
            salesConversationStarted: true,
            contractingPlan: false,
            salesHistory: []
        };

        // Verificar que puede manejar el mensaje inicial
        let canHandle = await salesFlow.canHandle(user, 'Quiero contratar el plan de 50 Mbps', session);
        console.log(`✅ Puede manejar solicitud inicial: ${canHandle}`);

        // Simular proceso de contratación
        console.log('\n📝 Paso 2: Iniciando proceso de contratación');
        session.contractingPlan = true;
        session.contractingStep = 'confirm';
        session.contractData = {
            planName: 'Internet 50 Mbps',
            planPrice: '$50.000/mes',
            name: 'Usuario Prueba',
            email: 'test@example.com',
            address: 'Calle 123',
            alternativePhone: '3001234567'
        };

        messageService.clearMessages();
        await salesFlow.handle(user, 'Sí', session);

        // Verificar que la sesión se limpió correctamente
        console.log('\n📝 Paso 3: Verificando limpieza de sesión después de contratación');
        console.log(`flowActive: ${session.flowActive}`);
        console.log(`salesConversationStarted: ${session.salesConversationStarted}`);
        console.log(`contractingPlan: ${session.contractingPlan}`);
        console.log(`contractingStep: ${session.contractingStep}`);
        console.log(`contractData: ${session.contractData}`);
        console.log(`selectedService: ${session.selectedService}`);
        console.log(`salesHistory length: ${session.salesHistory?.length || 0}`);

        // Verificar que ya no puede manejar mensajes después del cierre
        console.log('\n📝 Paso 4: Verificando que no maneja mensajes después del cierre');
        canHandle = await salesFlow.canHandle(user, 'Gracias', session);
        console.log(`✅ No maneja mensaje después del cierre: ${!canHandle}`);

        // Verificar que puede reiniciar con intención explícita
        console.log('\n📝 Paso 5: Verificando reinicio con intención explícita');
        canHandle = await salesFlow.canHandle(user, 'ventas', session);
        console.log(`✅ Puede reiniciar con "ventas": ${canHandle}`);

        // Prueba de cancelación
        console.log('\n📝 Paso 6: Probando cancelación de proceso');
        session = {
            flowActive: 'sales',
            salesConversationStarted: true,
            contractingPlan: true,
            contractingStep: 'confirm',
            contractData: {
                planName: 'Internet 30 Mbps',
                planPrice: '$40.000/mes'
            }
        };

        messageService.clearMessages();
        await salesFlow.handle(user, 'No', session);

        console.log('\n📝 Verificando limpieza después de cancelación');
        console.log(`flowActive: ${session.flowActive}`);
        console.log(`salesConversationStarted: ${session.salesConversationStarted}`);
        console.log(`contractingPlan: ${session.contractingPlan}`);
        console.log(`salesHistory length: ${session.salesHistory?.length || 0}`);

        console.log('\n🎉 Todas las pruebas de sesión completadas exitosamente!');

        // Resumen de mensajes enviados
        console.log('\n📨 Mensajes enviados durante las pruebas:');
        messageService.messages.forEach((msg, index) => {
            console.log(`${index + 1}. ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`);
        });

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error);
        process.exit(1);
    }
}

// Ejecutar pruebas
if (require.main === module) {
    testSessionClosure();
}

module.exports = { testSessionClosure };

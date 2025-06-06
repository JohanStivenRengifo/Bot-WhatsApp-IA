import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';

describe('Message Utils', () => {
    describe('extractMenuCommand', () => {
        test('should extract commands from simple messages', () => {
            expect(extractMenuCommand('factura')).toBe('factura');
            expect(extractMenuCommand('menu')).toBe('menu');
            expect(extractMenuCommand('ticket')).toBe('ticket');
            expect(extractMenuCommand('Ya soy cliente')).toBe('soporte');
        });

        test('should extract commands from menu button messages', () => {
            expect(extractMenuCommand('📄 Mi Factura')).toBe('factura');
            expect(extractMenuCommand('📄 Mi Factura\nConsultar y descargar facturas')).toBe('factura');
            expect(extractMenuCommand('📡 Test de Conexión\nVerificar estado de tu conexión')).toBe('ping');
            expect(extractMenuCommand('🔧 Soporte Técnico\nReportar problemas técnicos')).toBe('ticket');
            expect(extractMenuCommand('🏠 Menú Principal')).toBe('menu');
            expect(extractMenuCommand('📍 Puntos de Pago\nUbicaciones para pagar')).toBe('puntos_pago');
        }); test('should handle variations of the same command', () => {
            expect(extractMenuCommand('crear ticket')).toBe('ticket');
            expect(extractMenuCommand('soporte técnico')).toBe('ticket');
            expect(extractMenuCommand('test de conexión')).toBe('ping');
            expect(extractMenuCommand('ver saldo pendiente')).toBe('deuda');
        });

        test('should recognize session navigation commands', () => {
            expect(extractMenuCommand('menu principal')).toBe('menu');
            expect(extractMenuCommand('volver')).toBe('menu');
            expect(extractMenuCommand('finalizar')).toBe('finalizar');
            expect(extractMenuCommand('cerrar sesión')).toBe('cerrar_sesion');
            expect(extractMenuCommand('👋 Cerrar Sesión')).toBe('cerrar_sesion');
            expect(extractMenuCommand('logout')).toBe('cerrar_sesion');
        });
    });

    describe('isMenuCommand', () => {
        test('should check if message matches any expected command', () => {
            expect(isMenuCommand('📄 Mi Factura\nConsultar y descargar facturas', ['factura'])).toBe(true);
            expect(isMenuCommand('📡 Test de Conexión', ['ping', 'test'])).toBe(true);
            expect(isMenuCommand('algo completamente diferente', ['factura', 'ping'])).toBe(false);
        });
    });
});

import { User } from '../interfaces/User';
import { SessionData } from '../interfaces/WhatsAppMessage';
import { CustomerService } from './CustomerService';
import { MessageService } from './MessageService';

interface ServiceInfo {
    id: string;
    customerId: string;
    name: string;
    status: 'active' | 'suspended' | 'cancelled';
    plan: string;
    address: string;
    monthlyFee: number;
    installationDate: string;
    nextBillingDate: string;
}

export class MultiServiceManager {
    private customerService: CustomerService;
    private messageService: MessageService;

    constructor(customerService: CustomerService, messageService: MessageService) {
        this.customerService = customerService;
        this.messageService = messageService;
    }

    /**
     * Obtiene todos los servicios de un usuario
     */
    async getUserServices(phoneNumber: string): Promise<ServiceInfo[]> {
        try {
            // En una implementación real, esto vendría de WispHub API
            // Por ahora simulamos datos
            return await this.simulateUserServices(phoneNumber);
        } catch (error) {
            console.error('Error obteniendo servicios del usuario:', error);
            return [];
        }
    }

    /**
     * Verifica si un usuario tiene múltiples servicios
     */
    async hasMultipleServices(phoneNumber: string): Promise<boolean> {
        const services = await this.getUserServices(phoneNumber);
        return services.length > 1;
    }

    /**
     * Maneja la selección de servicio para usuarios multi-servicio
     */
    async handleServiceSelection(user: User, session: SessionData): Promise<boolean> {
        const services = await this.getUserServices(user.phoneNumber);

        if (services.length === 0) {
            await this.messageService.sendTextMessage(user.phoneNumber,
                '❌ No se encontraron servicios asociados a tu número.\n\n' +
                'Si crees que es un error, contacta a soporte técnico.');
            return false;
        }

        if (services.length === 1) {
            // Usuario con un solo servicio, seleccionar automáticamente
            session.selectedServiceId = services[0].id;
            session.availableServices = services.map(s => ({
                id: s.id,
                name: s.name,
                status: s.status
            }));
            return true;
        }

        // Usuario con múltiples servicios, mostrar selector
        await this.showServiceSelector(user, services, session);
        return false; // Esperar selección del usuario
    }

    /**
     * Muestra el selector de servicios
     */
    private async showServiceSelector(user: User, services: ServiceInfo[], session: SessionData): Promise<void> {
        let servicesList = '🏠 **Selecciona el servicio a consultar:**\n\n';

        services.forEach((service, index) => {
            const statusIcon = this.getServiceStatusIcon(service.status);
            servicesList += `${index + 1}. ${statusIcon} **${service.name}**\n`;
            servicesList += `   📍 ${service.address}\n`;
            servicesList += `   📶 ${service.plan}\n`;
            servicesList += `   💰 $${service.monthlyFee.toLocaleString()}/mes\n`;
            servicesList += `   📊 Estado: ${this.getServiceStatusText(service.status)}\n\n`;
        });

        servicesList += '📝 **¿Cómo seleccionar?**\n';
        servicesList += '• Escribe el número del servicio (1, 2, 3...)\n';
        servicesList += '• O escribe "todos" para ver información de todos los servicios\n\n';
        servicesList += '💡 Tip: Puedes cambiar de servicio en cualquier momento escribiendo "cambiar_servicio"';

        await this.messageService.sendTextMessage(user.phoneNumber, servicesList);

        // Guardar servicios disponibles en la sesión
        session.availableServices = services.map(s => ({
            id: s.id,
            name: s.name,
            status: s.status
        }));
        session.step = 'service_selection';
    }

    /**
     * Procesa la selección de servicio del usuario
     */
    async processServiceSelection(user: User, message: string, session: SessionData): Promise<boolean> {
        if (!session.availableServices) {
            return false;
        }

        const normalizedMessage = message.toLowerCase().trim();

        // Manejar selección por número
        const serviceIndex = parseInt(normalizedMessage) - 1;
        if (!isNaN(serviceIndex) && serviceIndex >= 0 && serviceIndex < session.availableServices.length) {
            const selectedService = session.availableServices[serviceIndex];
            session.selectedServiceId = selectedService.id;
            session.step = undefined;

            await this.messageService.sendTextMessage(user.phoneNumber,
                `✅ **Servicio seleccionado:**\n\n` +
                `🏠 ${selectedService.name}\n` +
                `📊 Estado: ${this.getServiceStatusText(selectedService.status)}\n\n` +
                `Ahora puedes consultar información de este servicio. 👍\n\n` +
                `💡 Escribe "menu" para ver las opciones disponibles.`);

            return true;
        }

        // Manejar selección "todos"
        if (normalizedMessage === 'todos' || normalizedMessage === 'all') {
            session.selectedServiceId = 'all';
            session.step = undefined;

            await this.messageService.sendTextMessage(user.phoneNumber,
                `✅ **Modo multi-servicio activado**\n\n` +
                `📊 Se mostrará información de todos tus servicios.\n\n` +
                `💡 Escribe "menu" para ver las opciones disponibles.`);

            return true;
        }

        // Mensaje de error para selección inválida
        await this.messageService.sendTextMessage(user.phoneNumber,
            `❌ Selección no válida.\n\n` +
            `Por favor:\n` +
            `• Escribe un número del 1 al ${session.availableServices.length}\n` +
            `• O escribe "todos" para seleccionar todos los servicios\n\n` +
            `💡 Ejemplo: escribe "1" para seleccionar el primer servicio.`);

        return false;
    }

    /**
     * Obtiene información del servicio seleccionado
     */
    async getSelectedServiceInfo(session: SessionData): Promise<ServiceInfo | ServiceInfo[] | null> {
        if (!session.selectedServiceId) {
            return null;
        }

        const services = await this.getUserServices(''); // En implementación real necesitaríamos el phoneNumber

        if (session.selectedServiceId === 'all') {
            return services;
        }

        return services.find(s => s.id === session.selectedServiceId) || null;
    }

    /**
     * Simula servicios de usuario para desarrollo
     */
    private async simulateUserServices(phoneNumber: string): Promise<ServiceInfo[]> {
        // Simular diferentes escenarios basados en el número de teléfono
        const lastDigit = parseInt(phoneNumber.slice(-1));

        if (lastDigit % 3 === 0) {
            // Usuario con múltiples servicios
            return [
                {
                    id: 'srv_001',
                    customerId: 'cust_001',
                    name: 'Casa Principal',
                    status: 'active',
                    plan: 'Internet 100 Mbps',
                    address: 'Calle 123 #45-67, Bogotá',
                    monthlyFee: 58900,
                    installationDate: '2023-01-15',
                    nextBillingDate: '2024-06-15'
                },
                {
                    id: 'srv_002',
                    customerId: 'cust_001',
                    name: 'Oficina',
                    status: 'active',
                    plan: 'Internet 200 Mbps + TV',
                    address: 'Carrera 789 #12-34, Bogotá',
                    monthlyFee: 89900,
                    installationDate: '2023-06-20',
                    nextBillingDate: '2024-06-20'
                }
            ];
        } else if (lastDigit % 3 === 1) {
            // Usuario con servicio suspendido
            return [
                {
                    id: 'srv_003',
                    customerId: 'cust_002',
                    name: 'Residencia',
                    status: 'suspended',
                    plan: 'Internet 50 Mbps',
                    address: 'Avenida 456 #78-90, Medellín',
                    monthlyFee: 45900,
                    installationDate: '2022-03-10',
                    nextBillingDate: '2024-06-10'
                }
            ];
        } else {
            // Usuario con servicio normal
            return [
                {
                    id: 'srv_004',
                    customerId: 'cust_003',
                    name: 'Hogar',
                    status: 'active',
                    plan: 'Internet 100 Mbps + TV',
                    address: 'Diagonal 321 #54-76, Cali',
                    monthlyFee: 78900,
                    installationDate: '2023-08-05',
                    nextBillingDate: '2024-06-05'
                }
            ];
        }
    }

    /**
     * Obtiene el icono para el estado del servicio
     */
    private getServiceStatusIcon(status: string): string {
        switch (status) {
            case 'active': return '🟢';
            case 'suspended': return '🟡';
            case 'cancelled': return '🔴';
            default: return '⚪';
        }
    }

    /**
     * Obtiene el texto del estado del servicio
     */
    private getServiceStatusText(status: string): string {
        switch (status) {
            case 'active': return 'Activo';
            case 'suspended': return 'Suspendido';
            case 'cancelled': return 'Cancelado';
            default: return 'Desconocido';
        }
    }

    /**
     * Resetea la selección de servicio
     */
    resetServiceSelection(session: SessionData): void {
        session.selectedServiceId = undefined;
        session.availableServices = undefined;
        session.step = undefined;
    }
}

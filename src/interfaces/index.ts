export * from './User';
export * from './Ticket';
export * from './Invoice';
export * from './AIService';
export * from './WhatsAppMessage';
export * from './OverdueCustomer';

export interface PaymentPoint {
    name: string;
    address: string;
    hours: string;
    phone: string;
    latitude: number;
    longitude: number;
}

export interface UpgradePlan {
    name: string;
    speed: string;
    price: number;
}
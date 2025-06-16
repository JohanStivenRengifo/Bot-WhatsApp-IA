export * from './User';
export * from './Ticket';
export * from './Invoice';
export * from './WhatsAppMessage';
export * from './OverdueCustomer';
export * from './CustomerServiceInfo';
export { PaymentPoint } from './PaymentPoint';

export interface UpgradePlan {
    name: string;
    speed: string;
    price: number;
}
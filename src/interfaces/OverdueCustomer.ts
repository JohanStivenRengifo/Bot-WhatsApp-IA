export interface OverdueCustomer {
    id: string;
    name: string;
    email?: string;
    document?: string;
    ip_address?: string;
    status?: string;
    lastDueDate: Date;
    amount: number;
}

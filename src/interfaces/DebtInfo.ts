export interface DebtInfo {
    customerId: string;
    totalAmount: number;
    invoicesCount: number;
    status: 'pendiente' | 'pagado' | 'vencido';
    lastDueDate?: Date;
    invoices: Array<{
        id: string;
        amount: number;
        dueDate: Date;
        status: string;
        description?: string;
    }>;
}

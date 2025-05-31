export interface Invoice {
    id: string;
    customerId: string;
    amount: number;
    dueDate: Date;
    status: 'pending' | 'paid' | 'overdue';
    pdfUrl?: string;
}
export interface Invoice {
    id: string;
    customerId: string;
    amount: number;
    dueDate: Date;
    status: 'pending' | 'paid' | 'overdue';
    pdfUrl?: string;

    // Campos adicionales para compatibilidad con API en español
    monto?: number;
    fecha_vencimiento?: string;
}
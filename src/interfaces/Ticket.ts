export interface Ticket {
    id: string;
    customerId: string;
    subject: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    createdAt: Date;
}
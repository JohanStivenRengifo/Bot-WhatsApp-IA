export interface Ticket {
    id: string;
    customerId: string;
    subject: string;
    description: string;
    status: 'nuevo' | 'en_progreso' | 'resuelto' | 'cerrado';
    priority: 'alta' | 'media' | 'baja';
    technician?: string;
    createdAt: Date;
    createdBy?: string;
    completedBy?: string;
    estimatedStartDate?: Date;
    estimatedEndDate?: Date;
    attachmentFile?: string;

    // Información adicional del cliente
    clientInfo?: {
        name: string;
        address?: string;
        phone?: string;
        comments?: string;
    };

    // Información del servicio
    serviceInfo?: {
        username?: string;
        ipAddress?: string;
        internetPlan?: string;
        router?: string;
        zone?: string;
        accessPoint?: string;
        installationDate?: Date;
    };
}
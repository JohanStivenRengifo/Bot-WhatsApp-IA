export interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    type: 'text' | 'interactive' | 'image' | 'document' | 'audio' | 'video' | 'location';
    text?: {
        body: string;
    };
    interactive?: {
        type: 'button_reply' | 'list_reply';
        button_reply?: {
            id: string;
            title: string;
        };
        list_reply?: {
            id: string;
            title: string;
            description?: string;
        };
    };
    image?: {
        id: string;
        mime_type: string;
        sha256: string;
        caption?: string;
    };
    document?: {
        id: string;
        filename: string;
        mime_type: string;
        sha256: string;
        caption?: string;
    };
    location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
    };
}

export interface WhatsAppWebhookValue {
    messaging_product: string;
    metadata: {
        display_phone_number: string;
        phone_number_id: string;
    };
    contacts?: Array<{
        profile: {
            name: string;
        };
        wa_id: string;
    }>;
    messages?: WhatsAppMessage[];
    statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
    }>;
}

export interface SessionData {
    changingPassword?: boolean;
    creatingTicket?: boolean;
    step?: string;
    category?: string;
    description?: string;
    newPassword?: string;
}

export interface CustomerData {
    id: string;
    name: string;
    email?: string;
    document?: string;
    ip_address?: string;
    status?: string;
}

export interface PlanData {
    id: string;
    name: string;
    speed: string;
    price: number;
    description?: string;
}

export interface PaymentPoint {
    id: string;
    name: string;
    address: string;
    hours: string;
    phone: string;
    latitude: number;
    longitude: number;
}

export interface DebtInfo {
    totalDebt: number;
    pendingInvoices: number;
    nextDueDate: Date;
    overdueAmount?: number;
}
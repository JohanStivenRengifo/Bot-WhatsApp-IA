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
    // Flags de estado de flujos
    changingPassword: boolean;
    creatingTicket: boolean;    // Nuevos flags para flows
    flowActive?: string;
    selectedService?: 'ventas' | 'soporte';
    consultingInvoices?: boolean;
    upgradingPlan?: boolean;
    salesConversationStarted?: boolean;
    
    // Flags para proceso de contratación
    contractingPlan?: boolean;
    contractingStep?: 'name' | 'email' | 'address' | 'phone' | 'confirm';
    contractData?: {
        planName: string;
        planPrice: string;
        startTime: Date;
        name?: string;
        email?: string;
        address?: string;
        alternativePhone?: string;
    };

    // Flags para diagnóstico IP
    diagnosticInProgress?: boolean;
    diagnosticTaskId?: string;

    // Flags para selección de servicio
    awaitingServiceSelection?: boolean;

    // Datos del paso actual
    step?: 'category' | 'description' | 'confirmation' | 'current_password' | 'new_password' | 'verify_password' | 'confirm_password' | 'service_selection' | 'payment_verification' | 'plan_type_selection' | 'internet_plan_selection' | 'tv_plan_selection';
    category?: string;
    description?: string;
    newPassword?: string;
    asunto?: string;

    // Datos específicos para upgrade de planes
    planType?: string; // 'upgrade_internet', 'add_tv', 'combo_plan'
    planCategory?: string; // 'internet', 'tv', 'combo'
    selectedPlanId?: string;
    selectedTVPlanId?: string;

    // Datos de ticket
    ticketData?: {
        startTime: Date;
        clientName: string;
        category?: string;
        urgency?: string;
    };

    // Historial de conversación de ventas
    salesHistory?: Array<{
        user: string;
        ai: string;
        timestamp: Date;
    }>;

    // Datos de servicio para usuarios multi-servicio
    selectedServiceId?: string;
    availableServices?: Array<{
        id: string;
        name: string;
        status: string;
    }>;

    // Timeout de sesión (10 minutos)
    lastActivity?: Date;
    sessionTimeout?: NodeJS.Timeout;
}

export interface CustomerData {
    id: string;
    name: string;
    email?: string;
    document?: string;
    ip_address?: string;
    status?: string;
    isInactive?: boolean;
    address?: string;
    phone?: string;
    comments?: string;
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
    totalAmount: number; // Alias para totalDebt
    pendingInvoices: number;
    invoicesCount: number; // Alias para pendingInvoices
    nextDueDate: Date;
    overdueAmount?: number;
    status: 'pending' | 'overdue' | 'critical' | 'partial';
}
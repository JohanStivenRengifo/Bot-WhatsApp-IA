/**
 * Utilidades para el procesamiento y reconocimiento de mensajes de WhatsApp
 */

/**
 * Extrae el ID o comando principal de un mensaje de botón de menú
 * Los botones del menú pueden enviar diferentes formatos:
 * - Solo el ID: "factura"
 * - Texto con título: "📄 Mi Factura"
 * - Texto completo: "📄 Mi Factura\nConsultar y descargar facturas"
 * - Objeto interactivo: { type: 'interactive', interactive: { button_reply: { id: 'factura' } } }
 */
export function extractMenuCommand(message: string | any): string {
    // Manejar caso donde message no es string (objeto, undefined, etc.)
    if (!message) return '';

    // Si es un objeto interactivo, extraer el ID directamente
    if (typeof message === 'object') {
        try {
            // Manejar botones interactivos
            if (message.type === 'interactive' && message.interactive) {
                if (message.interactive.button_reply && message.interactive.button_reply.id) {
                    return message.interactive.button_reply.id;
                }

                if (message.interactive.list_reply && message.interactive.list_reply.id) {
                    return message.interactive.list_reply.id;
                }
            }

            // Si tiene un campo 'text' con un campo 'body' (formato alternativo)
            if (message.text && typeof message.text.body === 'string') {
                return extractMenuCommand(message.text.body);
            }
        } catch (error) {
            console.error('Error extrayendo comando de objeto interactivo:', error);
            return '';
        }

        return '';
    }

    // Normalizar el mensaje
    const normalizedMessage = message.toLowerCase().trim();

    // Mapeo de patrones de texto de botones a comandos
    const menuPatterns: Record<string, string> = {
        // Servicios Técnicos
        'ping': 'ping',
        'test de conexión': 'ping',
        'test de conexion': 'ping',
        'verificar estado': 'ping',
        'conexión': 'ping',
        'conexion': 'ping',
        'verificar estado de tu conexión': 'ping',
        '📡 test de conexión': 'ping',
        '📡 test de conexion': 'ping',

        'ticket': 'ticket', 'soporte técnico': 'ticket',
        'soporte tecnico': 'ticket',
        'reportar problemas': 'ticket',
        'crear ticket': 'ticket',
        'reportar problema': 'ticket',
        'reportar falla': 'ticket',
        'reportar problemas técnicos': 'ticket',
        'reportar problemas tecnico': 'ticket',
        'soporte': 'ticket',
        'ya soy cliente': 'soporte',
        '🔧 soporte técnico': 'ticket',
        '🔧 soporte tecnico': 'ticket',

        // Facturación
        'factura': 'factura',
        'mi factura': 'factura',
        'facturas': 'factura',
        'consultar factura': 'factura',
        'consultar y descargar facturas': 'factura',
        'deuda': 'deuda',
        'consultar deuda': 'deuda',
        'ver saldo pendiente': 'deuda',
        'saldo pendiente': 'deuda',
        'puntos_pago': 'puntos_pago',
        'puntos de pago': 'puntos_pago',
        'ubicaciones para pagar': 'puntos_pago', 'lugares de pago': 'puntos_pago',

        // Cuenta
        'cambiar_clave': 'cambiar_clave',
        'cambiar contraseña': 'cambiar_clave',
        'actualizar clave': 'cambiar_clave',
        'cambiar clave': 'cambiar_clave',

        'mejorar_plan': 'mejorar_plan', 'mejorar plan': 'mejorar_plan',
        'upgrade de velocidad': 'mejorar_plan',
        '⬆️ mejorar plan': 'mejorar_plan',
        '⬆ mejorar plan': 'mejorar_plan', 'mejorar mi plan': 'mejorar_plan',
        'upgrade plan': 'mejorar_plan', 'validar_pago': 'validar_pago',
        'validar pago': 'validar_pago',
        'subir comprobante': 'validar_pago',
        'comprobante de pago': 'validar_pago',
        '💳 validar pago': 'validar_pago',
        '💳 subir comprobante': 'validar_pago',
        'Validar Pago': 'validar_pago',
        'Subir comprobante de pago': 'validar_pago',
        'Validar Pago\nSubir comprobante de pago': 'validar_pago',
        '💳 Validar Pago': 'validar_pago',
        '💳 Validar Pago\nSubir comprobante de pago': 'validar_pago',
        'comprobante_pago': 'validar_pago',

        // Cerrar sesión
        'cerrar_sesion': 'cerrar_sesion',
        'cerrar sesion': 'cerrar_sesion',
        'cerrar sesión': 'cerrar_sesion',
        'finalizar sesión': 'cerrar_sesion',
        'finalizar sesion': 'cerrar_sesion',
        'logout': 'cerrar_sesion', 'terminar sesion': 'cerrar_sesion',
        'terminar sesión': 'cerrar_sesion',

        // Agentes humanos
        'hablar_agente': 'hablar_agente',
        'hablar con agente': 'hablar_agente',
        'agente': 'hablar_agente',
        'agente humano': 'hablar_agente',
        'soporte humano': 'hablar_agente',
        'contactar agente': 'hablar_agente',
        'asesor': 'hablar_agente',
        'operador': 'hablar_agente',
        'representante': 'hablar_agente',
        'persona real': 'hablar_agente',
        '👨‍💼 hablar con agente': 'hablar_agente',

        // Comandos generales
        'menu': 'menu',
        'menú': 'menu',
        'menú principal': 'menu',
        'menu principal': 'menu',
        'inicio': 'menu',
        'volver': 'menu',
        'regresar': 'menu',
        'finalizar': 'finalizar',
        'terminar': 'finalizar',
        'salir': 'finalizar',
        'ayuda': 'ayuda',
        'help': 'ayuda'
    };

    // 1. Primero, verificar si es un ID directo
    if (menuPatterns[normalizedMessage]) {
        return menuPatterns[normalizedMessage];
    }

    // 2. Buscar por patrones que contengan texto específico
    for (const [pattern, command] of Object.entries(menuPatterns)) {
        if (normalizedMessage.includes(pattern)) {
            return command;
        }
    }    // 3. Verificar si contiene emojis y extraer texto principal
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const textWithoutEmojis = normalizedMessage.replace(emojiPattern, '').trim();

    // Verificación específica para mensajes de validación de pago
    if (message.includes('💳 Validar Pago') ||
        normalizedMessage.includes('validar pago') ||
        normalizedMessage.includes('subir comprobante')) {
        console.log(`Patrón de validación de pago detectado en: "${message}"`);
        return 'validar_pago';
    }

    // Normalizar eliminando saltos de línea para capturar casos como "💳 Validar Pago\nSubir comprobante de pago"
    const flattenedMessage = message.replace(/[\r\n]+/g, ' ').toLowerCase().trim();
    if (flattenedMessage.includes('validar pago') && flattenedMessage.includes('comprobante')) {
        console.log(`Mensaje aplanado de validación de pago: "${flattenedMessage}"`);
        return 'validar_pago';
    }

    // Dividir por saltos de línea y tomar la primera parte (título)
    const titlePart = textWithoutEmojis.split('\n')[0].trim();

    // Buscar nuevamente con el título sin emojis
    for (const [pattern, command] of Object.entries(menuPatterns)) {
        if (titlePart.includes(pattern) || pattern.includes(titlePart)) {
            return command;
        }
    }

    // 4. Como última opción, devolver el mensaje original normalizado
    return normalizedMessage;
}

/**
 * Verifica si un mensaje corresponde a un comando específico del menú
 */
export function isMenuCommand(message: string | any, expectedCommands: string[]): boolean {
    // Manejar caso para objetos interactivos
    if (typeof message === 'object') {
        try {
            // Manejar botones interactivos
            if (message.type === 'interactive' && message.interactive) {
                if (message.interactive.button_reply && message.interactive.button_reply.id) {
                    return expectedCommands.includes(message.interactive.button_reply.id);
                }

                if (message.interactive.list_reply && message.interactive.list_reply.id) {
                    return expectedCommands.includes(message.interactive.list_reply.id);
                }

                // Verificar por título del botón (caso común)
                if (message.interactive.button_reply && message.interactive.button_reply.title) {
                    const buttonTitle = message.interactive.button_reply.title.toLowerCase().trim();
                    return expectedCommands.some(cmd => buttonTitle.includes(cmd.toLowerCase()));
                }
            }

            // Si tiene un campo 'text' con un campo 'body' (formato alternativo)
            if (message.text && typeof message.text.body === 'string') {
                return isMenuCommand(message.text.body, expectedCommands);
            }

            return false;
        } catch (error) {
            console.error('Error verificando comando interactivo:', error);
            return false;
        }
    }

    // Manejar caso donde message no es string ni objeto
    if (typeof message !== 'string') return false;

    // Primero intentamos extraer el comando exacto
    const extractedCommand = extractMenuCommand(message);
    if (expectedCommands.includes(extractedCommand)) {
        return true;
    }// Verificación especial para el caso de validación de pago
    if ((message.includes('Validar Pago') || message.includes('validar pago') ||
        message.includes('💳') || message.includes('comprobante')) &&
        expectedCommands.includes('validar_pago')) {
        console.log(`Detectado formato especial de validación de pago: "${message}"`);
        return true;
    }

    // Manejar el caso específico con salto de línea para validación de pago
    if (message.includes('💳 Validar Pago') &&
        message.includes('Subir comprobante de pago') &&
        expectedCommands.includes('validar_pago')) {
        console.log(`Detectado mensaje interactivo de validación de pago: "${message}"`);
        return true;
    }

    // Prueba una versión normalizada del mensaje (sin saltos de línea)
    const flattenedMessage = message.replace(/[\r\n]+/g, ' ');
    if (flattenedMessage.includes('💳 Validar Pago') &&
        flattenedMessage.includes('Subir comprobante de pago') &&
        expectedCommands.includes('validar_pago')) {
        console.log(`Detectado mensaje interactivo normalizado de validación de pago: "${flattenedMessage}"`);
        return true;
    }

    // Si no coincide exactamente, comprobamos si el mensaje normalizado contiene alguno 
    // de los comandos esperados (útil para mensajes con emojis o formato especial)
    const normalizedMessage = message.toLowerCase().trim();

    // Eliminar emojis para hacer una comparación más precisa
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const textWithoutEmojis = normalizedMessage.replace(emojiPattern, '').trim();

    // Verificar si el mensaje (con o sin emojis) contiene alguno de los comandos esperados
    return expectedCommands.some(cmd =>
        normalizedMessage.includes(cmd) || textWithoutEmojis.includes(cmd)
    );
}

/**
 * Normaliza un mensaje para comparación
 */
export function normalizeMessage(message: string): string {
    return message.toLowerCase().trim();
}

/**
 * Verifica si un mensaje contiene alguna de las palabras clave especificadas
 */
export function containsKeywords(message: string, keywords: string[]): boolean {
    const normalizedMessage = normalizeMessage(message);
    return keywords.some(keyword =>
        normalizedMessage.includes(keyword.toLowerCase())
    );
}

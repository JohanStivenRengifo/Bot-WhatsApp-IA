/**
 * Utilidades para el procesamiento y reconocimiento de mensajes de WhatsApp
 */

/**
 * Extrae el ID o comando principal de un mensaje de botón de menú
 * Los botones del menú pueden enviar diferentes formatos:
 * - Solo el ID: "factura"
 * - Texto con título: "📄 Mi Factura"
 * - Texto completo: "📄 Mi Factura\nConsultar y descargar facturas"
 */
export function extractMenuCommand(message: string): string {
    if (!message) return '';    // Normalizar el mensaje
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
        '⬆ mejorar plan': 'mejorar_plan',
        'mejorar mi plan': 'mejorar_plan',
        'upgrade plan': 'mejorar_plan',
        'validar_pago': 'validar_pago',
        'validar pago': 'validar_pago',
        'subir comprobante': 'validar_pago',
        'comprobante de pago': 'validar_pago',

        // Cerrar sesión
        'cerrar_sesion': 'cerrar_sesion',
        'cerrar sesion': 'cerrar_sesion',
        'cerrar sesión': 'cerrar_sesion',
        'finalizar sesión': 'cerrar_sesion',
        'finalizar sesion': 'cerrar_sesion',
        'logout': 'cerrar_sesion',
        'terminar sesion': 'cerrar_sesion',
        'terminar sesión': 'cerrar_sesion',

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
    }

    // 3. Verificar si contiene emojis y extraer texto principal
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const textWithoutEmojis = normalizedMessage.replace(emojiPattern, '').trim();

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
export function isMenuCommand(message: string, expectedCommands: string[]): boolean {
    const extractedCommand = extractMenuCommand(message);
    return expectedCommands.includes(extractedCommand);
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

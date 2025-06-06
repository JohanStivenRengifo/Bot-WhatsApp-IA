# Arquitectura de Flujos del Bot

## Resumen
La arquitectura del bot ha sido reorganizada para eliminar menús duplicados y simplificar la navegación, manteniendo solo los flujos específicos requeridos.

## Flujos Principales

### 1. Flujo de Entrada
- **InitialSelectionFlow**: Maneja la selección inicial (Ventas o Soporte)
- **PrivacyPolicyFlow**: Gestiona la aceptación de la política de privacidad
- **AuthenticationFlow**: Autentica usuarios para servicios de soporte

### 2. Navegación Central
- **ClientMenuFlow**: Despachador central post-autenticación que redirige a flujos específicos

### 3. Flujos Específicos

#### Soporte Técnico
- **TicketCreationFlow**: Creación de tickets de soporte
- **IPDiagnosticFlow**: Test de conexión (ping)
- **PasswordChangeFlow**: Cambio de contraseña

#### Servicios Financieros
- **InvoicesFlow**: Consulta de facturas
- **DebtInquiryFlow**: Consulta de deuda
- **PaymentPointsFlow**: Información de medios de pago
- **PaymentReceiptFlow**: Validación de pagos

#### Comercial
- **SalesFlow**: Flujo de ventas
- **PlanUpgradeFlow**: Mejora de plan

#### General
- **LogoutFlow**: Cierre de sesión manual

## Flujo de Usuario

```
Usuario inicia conversación
    ↓
InitialSelectionFlow (Ventas/Soporte)
    ↓
[Si Soporte] → PrivacyPolicyFlow → AuthenticationFlow
    ↓
ClientMenuFlow (Menú principal)
    ↓
Redirección a flujos específicos según selección
```

## Orden de Registro de Flujos

Los flujos se registran en este orden para garantizar la precedencia correcta:

1. **InitialSelectionFlow** - Primera interacción
2. **PrivacyPolicyFlow** - Aceptación de términos
3. **AuthenticationFlow** - Autenticación de usuarios
4. **ClientMenuFlow** - Navegación post-autenticación
5. **Flujos específicos** - Servicios particulares

## Eliminaciones Realizadas

### Archivos Eliminados
- `TechnicalSupportFlow.ts` - Menú duplicado, funcionalidad integrada en ClientMenuFlow
- `MainMenuFlow.ts` - Reemplazado por navegación centralizada

### Beneficios
- ✅ Eliminación de duplicación de menús
- ✅ Navegación más clara y centralizada
- ✅ Mejor separación de responsabilidades
- ✅ Mantenimiento simplificado

## Estados de Sesión

El sistema utiliza flags de sesión para controlar qué flujo está activo:

```typescript
interface SessionData {
    flowActive: string;
    creatingTicket: boolean;
    changingPassword: boolean;
    upgradingPlan: boolean;
    consultingInvoices: boolean;
    diagnosticInProgress: boolean;
    // ... otros campos
}
```

## Notas Técnicas

- **ClientMenuFlow** actúa como un despachador que limpia estados anteriores y redirige
- Los flujos específicos solo se activan cuando sus condiciones particulares se cumplen
- La autenticación es requerida antes de acceder a los servicios de soporte
- El flujo de ventas no requiere autenticación
- Se implementó un sistema unificado de reconocimiento de comandos del menú

## Procesamiento de Mensajes de Menú

Para manejar correctamente los mensajes enviados por los botones del menú, se implementó un sistema que:

1. Extrae los comandos específicos de los textos enviados por los botones interactivos
2. Normaliza los mensajes para poder reconocer comandos de diferentes formatos

## Seguridad y Gestión de Sesiones

### Tiempo de Expiración de Sesión
- Las sesiones expiran automáticamente después de 10 minutos de inactividad
- Al expirar, se envía un mensaje al usuario: "Tu sesión ha caducado por inactividad. ¡Vuelve a escribir Soporte para continuar!"
- Se requiere una nueva autenticación después de la expiración

### Cierre Manual de Sesión
- Los usuarios pueden cerrar sesión explícitamente a través del menú principal
- Opción "Cerrar Sesión" disponible en la sección General del menú
- Al cerrar sesión, todos los datos temporales del usuario son eliminados

### Navegación Global
- Botones de navegación estándar ("Menú Principal" y "Finalizar") disponibles en múltiples flujos
- Los botones de navegación facilitan la transición entre secciones del bot
- El comando "Finalizar" cierra la conversación actual y muestra un mensaje de despedida

### Seguridad de Datos
- Los datos sensibles del usuario se eliminan al cerrar sesión
- No se almacenan contraseñas ni información confidencial en memoria más allá de lo necesario
- Todas las sesiones se limpian periódicamente para evitar acumulación de datos
3. Mapea los comandos a acciones específicas

```typescript
// Ejemplo de reconocimiento de comando de botón
// Entrada: "📄 Mi Factura\nConsultar y descargar facturas"
// Salida normalizada: "factura"

// Implementado en la utilidad messageUtils.ts
function extractMenuCommand(message: string): string {
    // Procesamiento de comandos de menú
    // ...
}
```

Todos los flujos utilizan este sistema para manejar correctamente las interacciones del usuario.

## Sistema de Navegación

El sistema de navegación ha sido mejorado con la adición de botones de navegación estandarizados en todos los flujos:

1. **Botones de Navegación Universal**
   - **Menú Principal** (🏠): Redirige al usuario al menú principal
   - **Finalizar** (✅): Finaliza la conversación actual

2. **Funciones de Navegación**
   ```typescript
   // Enviar botones de navegación estándar
   async sendNavigationButtons(phoneNumber, headerText, bodyText): Promise<void> {
     // Muestra los botones de Menú Principal y Finalizar
   }
   
   // Enviar botones de acción personalizados
   async sendActionButtons(phoneNumber, headerText, bodyText, buttons): Promise<void> {
     // Muestra botones personalizados para acciones específicas
   }
   ```

3. **Manejo Centralizado**
   - El `FlowManager` maneja automáticamente los comandos de navegación como "menu" y "finalizar"
   - Se aplica consistentemente en todos los flujos conversacionales

4. **Beneficios**
   - ✅ Experiencia de usuario mejorada con navegación intuitiva
   - ✅ Consistencia en la interfaz de usuario
   - ✅ Reducción de usuarios "atrapados" en flujos
   - ✅ Facilidad para regresar al menú principal desde cualquier punto

## Gestión de Sesiones

### Cierre Automático de Sesión

El sistema implementa un cierre automático de sesión por inactividad:

1. **Timeout Configurado**
   - Sesiones inactivas se cierran automáticamente después de 10 minutos
   - El contador se reinicia con cada interacción del usuario

2. **Mensaje de Notificación**
   ```
   ⏰ Sesión Expirada

   Tu sesión ha caducado por inactividad.

   ¡Vuelve a escribir Soporte para continuar!

   🔐 Por seguridad, deberás autenticarte nuevamente para acceder a los servicios.
   ```

3. **Implementación Técnica**
   - Cada sesión tiene un temporizador asociado que se reinicia con la actividad
   - Al expirar, se envía un mensaje al usuario y se limpian los datos de sesión
   - Requiere nueva autenticación para acceder a servicios protegidos

### Cierre Manual de Sesión

Se ha implementado un flujo específico para permitir al usuario cerrar su sesión manualmente:

1. **LogoutFlow**
   - Permite al usuario cerrar su sesión explícitamente
   - Accesible desde el menú principal con la opción "👋 Cerrar Sesión"
   - Responde a comandos como "cerrar sesión", "logout", "salir", etc.

2. **Proceso de Cierre**
   - Envía mensaje de confirmación al usuario
   - Limpia todos los datos de sesión
   - Marca al usuario como no autenticado
   - Elimina datos temporales y sensibles

3. **Beneficios de Seguridad**
   - ✅ Mayor control para el usuario sobre su información
   - ✅ Conformidad con mejores prácticas de seguridad
   - ✅ Protección de datos en dispositivos compartidos

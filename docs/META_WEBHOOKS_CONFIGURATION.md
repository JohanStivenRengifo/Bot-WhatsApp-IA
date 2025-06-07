# 🔧 CONFIGURACIÓN DE WEBHOOKS META API PARA BOT WHATSAPP

## 🎯 **CAMPOS DE WEBHOOK REQUERIDOS**

Basado en el análisis completo del bot y las funcionalidades implementadas, estos son los campos que **DEBEN ESTAR ACTIVOS** en la configuración de webhooks de Meta API:

---

## ✅ **CAMPOS OBLIGATORIOS (ACTIVAR)**

### **1. `messages` - ⭐ CRÍTICO**
```
✅ ACTIVAR - v23.0 - SUSCRIBIRSE
```
**Razón:** Este es el campo principal que recibe todos los mensajes de WhatsApp de los usuarios.
**Usado en:** 
- `WebhookController.ts` - Procesamiento de mensajes entrantes
- `MessageHandler.ts` - Enrutamiento de mensajes a flujos
- Todos los flujos conversacionales

### **2. `messaging_handovers` - ⭐ CRÍTICO PARA CRM**
```
✅ ACTIVAR - v23.0 - SUSCRIBIRSE
```
**Razón:** Esencial para el handover entre bot y agentes humanos del CRM.
**Usado en:**
- `AgentHandoverFlow.ts` - Transferencia a agentes
- `CRMController.ts` - Manejo de eventos de handover
- Meta Handover Protocol

### **3. `message_echoes` - 🔄 RECOMENDADO**
```
✅ ACTIVAR - v23.0 - SUSCRIBIRSE
```
**Razón:** Permite recibir confirmación de mensajes enviados por el bot.
**Usado en:**
- Confirmación de entrega de mensajes
- Debugging y logging
- Métricas de entrega

---

## ⚠️ **CAMPOS OPCIONALES (SEGÚN NECESIDAD)**

### **4. `message_template_status_update` - 📋 ÚTIL**
```
🟡 OPCIONAL - v23.0 - CONSIDERAR ACTIVAR
```
**Razón:** Notifica cuando cambia el estado de plantillas de mensajes.
**Beneficio:** Monitoreo de plantillas para mensajes estructurados del bot.

### **5. `phone_number_quality_update` - 📊 MONITOREO**
```
🟡 OPCIONAL - v23.0 - CONSIDERAR ACTIVAR
```
**Razón:** Monitorea la calidad del número de teléfono de WhatsApp Business.
**Beneficio:** Alertas sobre problemas de calidad que podrían afectar entregas.

### **6. `account_alerts` - 🚨 ALERTAS**
```
🟡 OPCIONAL - v23.0 - CONSIDERAR ACTIVAR
```
**Razón:** Recibe alertas importantes sobre la cuenta de WhatsApp Business.
**Beneficio:** Notificaciones de problemas críticos de la cuenta.

---

## ❌ **CAMPOS NO NECESARIOS (NO ACTIVAR)**

### **Campos que NO necesita este bot:**

```
❌ account_review_update - No relevante
❌ account_update - No necesario
❌ automatic_events - No usado
❌ business_capability_update - No relevante
❌ business_status_update - No usado
❌ campaign_status_update - No hay campañas
❌ flows - No usa WhatsApp Flows
❌ history - No necesario
❌ message_template_components_update - No usado
❌ message_template_quality_update - No crítico
❌ partner_solutions - No aplica
❌ payment_configuration_update - No hay pagos WhatsApp
❌ phone_number_name_update - No crítico
❌ security - Manejado internamente
❌ smb_app_state_sync - No es SMB app
❌ smb_message_echoes - No es SMB app
❌ template_category_update - No crítico
❌ tracking_events - No usado
❌ user_preferences - No implementado
```

---

## 🔧 **CONFIGURACIÓN RECOMENDADA FINAL**

### **Configuración Mínima (Producción):**
```
✅ messages (v23.0) - OBLIGATORIO
✅ messaging_handovers (v23.0) - OBLIGATORIO PARA CRM
```

### **Configuración Completa (Recomendada):**
```
✅ messages (v23.0) - OBLIGATORIO
✅ messaging_handovers (v23.0) - OBLIGATORIO PARA CRM
✅ message_echoes (v23.0) - CONFIRMACIONES
✅ phone_number_quality_update (v23.0) - MONITOREO
✅ account_alerts (v23.0) - ALERTAS
```

---

## 🎯 **JUSTIFICACIÓN TÉCNICA**

### **¿Por qué estos campos específicos?**

1. **`messages`**: El bot procesa mensajes de texto, interactivos (botones/listas), imágenes y documentos
2. **`messaging_handovers`**: Implementa handover completo bot↔agente para casos como servicio suspendido
3. **`message_echoes`**: Mejora logging y debugging de mensajes enviados
4. **`phone_number_quality_update`**: Previene problemas de entrega
5. **`account_alerts`**: Monitoreo proactivo de problemas

### **Funcionalidades que requieren estos webhooks:**

```typescript
// messages - Usado en TODOS los flujos
await messageHandler.processMessage(webhookMessage);

// messaging_handovers - Usado en AgentHandoverFlow
await this.executeMetaHandoverProtocol(user, ticketId);

// message_echoes - Usado para confirmaciones
console.log('✅ Mensaje enviado exitosamente:', echoData);
```

---

## 📋 **CHECKLIST DE CONFIGURACIÓN**

### **Pasos para configurar webhooks:**

1. **✅ Ir a Meta for Developers**
2. **✅ Seleccionar tu app de WhatsApp Business**
3. **✅ Ir a Configuración de Webhooks**
4. **✅ Activar campos obligatorios:**
   - ✅ `messages`
   - ✅ `messaging_handovers`
5. **✅ Activar campos recomendados:**
   - ✅ `message_echoes`
   - ✅ `phone_number_quality_update`
   - ✅ `account_alerts`
6. **✅ Configurar URL del webhook:**
   ```
   https://bot.conecta2tel.com/webhook
   ```
7. **✅ Configurar token de verificación**
8. **✅ Probar la configuración**

---

## 🔐 **SEGURIDAD Y VERIFICACIÓN**

### **Verificación de webhooks implementada:**

```typescript
// En WebhookController.ts
if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado exitosamente');
    res.status(200).send(challenge);
}
```

### **Validación de signatures:**

```typescript
// Verificación de signature Meta
const signature = req.headers['x-hub-signature-256'];
const expectedSignature = crypto
    .createHmac('sha256', process.env.META_WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
```

---

## ⚡ **PRUEBAS RECOMENDADAS**

### **Después de activar webhooks:**

1. **Enviar mensaje de prueba** → Verificar que llega a `/webhook`
2. **Probar handover** → Solicitar agente y verificar `messaging_handovers`
3. **Verificar echoes** → Confirmar que se reciben confirmaciones
4. **Monitorear logs** → Revisar que todos los eventos lleguen correctamente

### **Comandos de prueba:**

```bash
# Probar webhook
curl -X POST https://bot.conecta2tel.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Probar handover
# (Usuario auténtico) → Escribir: "hablar con agente"
```

---

## 📊 **MONITOREO Y MÉTRICAS**

### **Webhooks a monitorear:**

```typescript
// Logs implementados en el bot
console.log(`📨 Webhook recibido: ${field}`);
console.log(`🔄 Handover iniciado: ${ticketId}`);
console.log(`✅ Mensaje procesado: ${messageId}`);
```

### **Alertas importantes:**

- Webhook `messages` no funciona → **CRÍTICO** → Bot no recibe mensajes
- Webhook `messaging_handovers` no funciona → **ALTO** → No hay handover a CRM
- Calidad del número baja → **MEDIO** → Problemas de entrega

---

**🎯 RESUMEN:** Activa mínimo `messages` y `messaging_handovers`, idealmente también `message_echoes`, `phone_number_quality_update` y `account_alerts` para una experiencia completa.

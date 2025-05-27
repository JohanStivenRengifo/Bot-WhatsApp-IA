// flows/facturacionFlow.js
const WisphubService = require('../services/wisphubService');
const { formatCurrency } = require('../utils/botUtils');
const logger = require('../utils/logger');

class FacturacionFlow {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.wisphubService = new WisphubService();
    }

    async handleFlow(conversation, message) {
        const step = conversation.currentStep || 'inicio';

        switch (step) {
            case 'inicio':
                return this.handleInicio(conversation);
            case 'consultar_deuda':
                return this.handleConsultarDeuda(conversation, message);
            case 'enviar_factura':
                return this.handleEnviarFactura(conversation, message);
            case 'validar_cliente':
                return this.handleValidarCliente(conversation, message);
            default:
                return this.handleInicio(conversation);
        }
    }

    async handleInicio(conversation) {
        try {
            const mensaje = 
                "🧾 *Facturación* 🧾\n\n" +
                "Selecciona una opción escribiendo el número correspondiente:\n\n" +
                "1️⃣ *Consultar deuda actual*\n" +
                "   • Ver saldo pendiente\n" +
                "   • Facturas vencidas\n\n" +
                "2️⃣ *Descargar última factura*\n" +
                "   • Recibir factura en PDF\n\n" +
                "3️⃣ *Validar mi cuenta*\n" +
                "   • Verificar estado de cliente\n\n" +
                "4️⃣ *Volver al menú principal*\n\n" +
                "❓ Escribe el número de la opción que necesitas";

            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                mensaje
            );

            conversation.currentStep = 'menu_facturacion';
            await conversation.save();
            return null;
        } catch (error) {
            logger.error('Error en handleInicio de FacturacionFlow:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "❌ Lo sentimos, ha ocurrido un error. Por favor, intenta nuevamente más tarde."
            );
            return { flow: 'main' };
        }
    }

    async handleConsultarDeuda(conversation, message) {
        try {
            // Verificar que el usuario tenga un ID válido
            if (!conversation.userData || !conversation.userData.id) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "❌ No se ha podido identificar tu cuenta. Por favor, valida tu cuenta primero seleccionando la opción 3."
                );
                return this.handleInicio(conversation);
            }

            // Obtener facturas pendientes del cliente
            const facturas = await this.wisphubService.getFacturasCliente(
                conversation.userData.id,
                { status: 'unpaid' }
            );

            if (!facturas || facturas.length === 0) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "✨ ¡No tienes facturas pendientes de pago! Tu cuenta está al día."
                );
                return this.handleInicio(conversation);
            }

            // Calcular el total de la deuda
            const totalDeuda = facturas.reduce((sum, factura) => sum + parseFloat(factura.amount), 0);
            
            // Contar facturas vencidas
            const hoy = new Date();
            const facturasVencidas = facturas.filter(factura => new Date(factura.due_date) < hoy);
            
            // Preparar mensaje de respuesta
            let mensaje = "💰 *Resumen de tu deuda actual*\n\n";
            mensaje += `📊 Total pendiente: ${formatCurrency(totalDeuda)}\n`;
            mensaje += `📝 Facturas pendientes: ${facturas.length}\n`;
            mensaje += `⚠️ Facturas vencidas: ${facturasVencidas.length}\n\n`;
            
            // Mostrar detalle de facturas
            mensaje += "*Detalle de facturas:*\n\n";
            facturas.forEach((factura, index) => {
                const fechaVencimiento = new Date(factura.due_date);
                const diasVencida = this.calcularDiasVencida(fechaVencimiento);
                const estadoIcon = diasVencida > 0 ? "⚠️" : "✅";
                
                mensaje += `${index + 1}. Factura #${factura.number} ${estadoIcon}\n`;
                mensaje += `   💰 Monto: ${formatCurrency(factura.amount)}\n`;
                mensaje += `   📅 Vence: ${fechaVencimiento.toLocaleDateString()}\n`;
                if (diasVencida > 0) {
                    mensaje += `   ⏱️ Vencida hace ${diasVencida} días\n`;
                }
                mensaje += "\n";
            });
            
            mensaje += "Escribe *MENU* para volver al menú de facturación.";
            
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                mensaje
            );
            
            // Guardar las facturas en la conversación para uso posterior
            conversation.userData.facturasTemp = facturas;
            conversation.currentStep = 'esperar_accion';
            await conversation.save();
            return null;
        } catch (error) {
            logger.error('Error en handleConsultarDeuda de FacturacionFlow:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "❌ Lo sentimos, ha ocurrido un error al consultar tu deuda. Por favor, intenta nuevamente más tarde."
            );
            return this.handleInicio(conversation);
        }
    }

    async handleEnviarFactura(conversation, message) {
        try {
            // Verificar que el usuario tenga un ID válido
            if (!conversation.userData || !conversation.userData.id) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "❌ No se ha podido identificar tu cuenta. Por favor, valida tu cuenta primero seleccionando la opción 3."
                );
                return this.handleInicio(conversation);
            }

            // Obtener la última factura del cliente
            const facturas = await this.wisphubService.getFacturasCliente(
                conversation.userData.id
            );

            if (!facturas || facturas.length === 0) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "❌ No se encontraron facturas asociadas a tu cuenta."
                );
                return this.handleInicio(conversation);
            }

            // Ordenar facturas por fecha (más reciente primero)
            facturas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const ultimaFactura = facturas[0];

            // Enviar mensaje de preparación
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "🔄 Estamos preparando tu factura. En un momento te la enviaremos..."
            );

            // Verificar si la factura tiene una URL de PDF
            if (!ultimaFactura.pdf_url) {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "❌ Lo sentimos, no se encontró el archivo PDF de la factura. Por favor, contacta a soporte."
                );
                return this.handleInicio(conversation);
            }

            // Enviar el PDF como documento
            await this.enviarDocumentoPDF(
                conversation.phoneNumber,
                ultimaFactura.pdf_url,
                `Factura #${ultimaFactura.number}.pdf`,
                `📄 Factura #${ultimaFactura.number} - ${formatCurrency(ultimaFactura.amount)}`
            );

            // Mensaje de confirmación
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "✅ Factura enviada correctamente. Escribe *MENU* para volver al menú de facturación."
            );

            conversation.currentStep = 'esperar_accion';
            await conversation.save();
            return null;
        } catch (error) {
            logger.error('Error en handleEnviarFactura de FacturacionFlow:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "❌ Lo sentimos, ha ocurrido un error al enviar la factura. Por favor, intenta nuevamente más tarde."
            );
            return this.handleInicio(conversation);
        }
    }

    async handleValidarCliente(conversation, message) {
        try {
            // Si ya tenemos los datos del usuario, mostrarlos
            if (conversation.userData && conversation.userData.id) {
                const clienteInfo = await this.wisphubService.validateCustomer(conversation.userData.id);
                
                if (clienteInfo.success) {
                    const cliente = clienteInfo.data;
                    let mensaje = "✅ *Información de tu cuenta*\n\n";
                    mensaje += `👤 Nombre: ${cliente.nombreCompleto}\n`;
                    mensaje += `🆔 ID: ${cliente.id}\n`;
                    mensaje += `📧 Email: ${cliente.email}\n`;
                    mensaje += `📱 Teléfono: ${cliente.telefono}\n`;
                    mensaje += `📍 Dirección: ${cliente.direccion}\n`;
                    mensaje += `🔄 Estado: ${cliente.estado}\n`;
                    mensaje += `📊 Plan: ${cliente.plan}\n\n`;
                    mensaje += "Escribe *MENU* para volver al menú de facturación.";
                    
                    await this.whatsappService.sendTextMessage(
                        conversation.phoneNumber,
                        mensaje
                    );
                    
                    conversation.currentStep = 'esperar_accion';
                    await conversation.save();
                    return null;
                } else {
                    await this.whatsappService.sendTextMessage(
                        conversation.phoneNumber,
                        "❌ No se pudo validar tu cuenta. Por favor, proporciona tu número de identificación (cédula o RUC):"
                    );
                    
                    conversation.currentStep = 'ingresar_id';
                    await conversation.save();
                    return null;
                }
            } else {
                await this.whatsappService.sendTextMessage(
                    conversation.phoneNumber,
                    "👤 Para validar tu cuenta, por favor proporciona tu número de identificación (cédula o RUC):"
                );
                
                conversation.currentStep = 'ingresar_id';
                await conversation.save();
                return null;
            }
        } catch (error) {
            logger.error('Error en handleValidarCliente de FacturacionFlow:', error);
            await this.whatsappService.sendTextMessage(
                conversation.phoneNumber,
                "❌ Lo sentimos, ha ocurrido un error al validar tu cuenta. Por favor, intenta nuevamente más tarde."
            );
            return this.handleInicio(conversation);
        }
    }

    async enviarDocumentoPDF(phoneNumber, pdfUrl, filename, caption) {
        try {
            // Usar el servicio de Meta API para enviar el documento
            await this.whatsappService.metaApiService.sendMediaMessage(
                phoneNumber,
                'document',
                pdfUrl,
                caption,
                { filename: filename }
            );
            return true;
        } catch (error) {
            logger.error('Error enviando documento PDF:', error);
            throw error;
        }
    }

    calcularDiasVencida(fechaVencimiento) {
        const hoy = new Date();
        const vencimiento = new Date(fechaVencimiento);
        
        // Si no está vencida, retornar 0
        if (vencimiento > hoy) return 0;
        
        // Calcular diferencia en días
        const diferencia = hoy - vencimiento;
        return Math.floor(diferencia / (1000 * 60 * 60 * 24));
    }
}

module.exports = FacturacionFlow;
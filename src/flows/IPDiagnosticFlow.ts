import { User, SessionData } from '../interfaces';
import { BaseConversationFlow } from './ConversationFlow';
import { MessageService, SecurityService, CustomerService } from '../services';
import { extractMenuCommand, isMenuCommand } from '../utils/messageUtils';
import { config } from '../config';
import axios from 'axios';

// Interfaces para manejar las respuestas de la API según la estructura real de WispHub
interface PingDetail {
    status: string;
    received: string;
    "packet-loss": string;
    sent: string;
    seq: string;
}

interface PingResultItem {
    [key: string]: PingDetail | string; // ping-1, ping-2, etc. o ping-exitoso
}

interface WispHubPingResponse {
    task_id: string;
}

interface WispHubTaskResponse {
    task: {
        status: string;
        id: string;
        result: PingResultItem[] | null;
    };
}

/**
 * Flujo para realizar diagnóstico de IP mediante ping
 */
export class IPDiagnosticFlow extends BaseConversationFlow {
    readonly name: string = 'IPDiagnosticFlow';
    private customerService: CustomerService;

    constructor(
        messageService: MessageService,
        securityService: SecurityService,
        customerService: CustomerService
    ) {
        super(messageService, securityService);
        this.customerService = customerService;
    }    /**
     * Verifica si el flujo puede manejar el mensaje actual
     */
    async canHandle(user: User, message: string, session: SessionData): Promise<boolean> {
        if (!user.authenticated) return false;

        // Si el flujo ya está activo (activado por ClientMenuFlow)
        if (session.flowActive === 'ipDiagnostic') {
            return true;
        }

        // Si ya hay un diagnóstico en progreso, este flujo debe manejar el mensaje
        if (session.diagnosticInProgress === true) return true;

        const extractedCommand = extractMenuCommand(message);

        // Verificar comando directo del menú
        if (extractedCommand === 'ping') return true;

        // Verificar otros comandos relacionados
        return isMenuCommand(message, [
            'test_conexion', 'test de conexion', 'test de conexión',
            'diagnostico_ip', 'diagnóstico ip', 'diagnostico ip',
            'ping_ip', 'ping ip', 'estado de conexion', 'estado de conexión',
            'verificar estado', 'verificar conexión'
        ]);
    }/**
     * Maneja el mensaje dentro del flujo de diagnóstico IP
     */
    async handle(user: User, message: string, session: SessionData): Promise<boolean> {
        try {
            // Obtener los datos del usuario para extraer el id_servicio
            const userData = this.decodeUserData(user);
            if (!userData || !userData.id_servicio) {
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '❌ No se pudo obtener la información de tu servicio. Por favor, contacta a soporte técnico.'
                );
                return true;
            }

            const id_servicio = userData.id_servicio;

            // Verificar si el diagnóstico ya está en progreso y si ya se inició la tarea
            if (session.diagnosticInProgress && session.diagnosticTaskId) {
                // Ya hay un diagnóstico en progreso, no hacer nada más
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '⏳ Ya tienes un diagnóstico en progreso. Te notificaré cuando esté listo.'
                );
                return true;
            }

            // Iniciar el proceso de diagnóstico si no está en progreso
            if (!session.diagnosticInProgress || !session.diagnosticTaskId) {
                // Activar el diagnóstico y limpiar cualquier tarea anterior
                session.diagnosticInProgress = true;
                session.diagnosticTaskId = undefined; await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    '🔄 Realizando prueba de conexión...\n\n' +
                    'Este proceso puede tomar entre 30 segundos y 3 minutos.\n' +
                    'Te notificaré cuando los resultados estén listos.'
                ); try {
                    // Validar número de pings (máximo 10 según documentación)
                    const numPings = Math.min(Math.max(3, 3), 10); // Entre 3 y 10 pings

                    console.log(`[IPDiagnostic] Iniciando ping para cliente ${id_servicio} con ${numPings} pings`);

                    // Realizar la petición de ping usando la API de WispHub
                    const pingResponse = await axios.post(
                        `${config.wisphub.baseUrl}clientes/${id_servicio}/ping/`,
                        {
                            pings: numPings,
                            interfaz: "ether1",
                            arp_ping: true
                        },
                        {
                            headers: {
                                'Authorization': config.wisphub.apiKey,
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000 // 10 segundos de timeout para la petición inicial
                        }
                    );

                    console.log(`[IPDiagnostic] Respuesta de ping recibida:`, pingResponse.status, pingResponse.data);

                    // Verificar que la respuesta sea 202 Accepted según documentación
                    if (pingResponse.status === 202 && pingResponse.data && pingResponse.data.task_id) {
                        session.diagnosticTaskId = pingResponse.data.task_id;
                        console.log(`[IPDiagnostic] Task ID recibido: ${session.diagnosticTaskId}`);

                        // Esperar 30 segundos antes de verificar el resultado inicial
                        setTimeout(() => this.checkPingResult(user, session, 0), 30000);
                    } else {
                        throw new Error(`Respuesta inesperada de la API: Status ${pingResponse.status}`);
                    }
                } catch (error: any) {
                    console.error(`[IPDiagnostic] Error al realizar ping:`, error.message);
                    session.diagnosticInProgress = false;

                    // Manejo específico de errores HTTP
                    if (error.response) {
                        const status = error.response.status;
                        if (status === 404) {
                            await this.messageService.sendTextMessage(
                                user.phoneNumber,
                                '❌ No se encontró información de tu servicio.\n\n' +
                                'Esto puede deberse a:\n' +
                                '• ID de servicio incorrecto\n' +
                                '• Servicio no registrado en el sistema\n\n' +
                                'Por favor, contacta a soporte técnico.'
                            );
                        } else if (status === 401) {
                            await this.messageService.sendTextMessage(
                                user.phoneNumber,
                                '❌ Error de autenticación con el servidor.\n\n' +
                                'Por favor, intenta nuevamente más tarde.'
                            );
                        } else {
                            await this.messageService.sendTextMessage(
                                user.phoneNumber,
                                `❌ Error del servidor (${status}). Por favor, intenta nuevamente más tarde.`
                            );
                        }
                    } else {
                        await this.messageService.sendTextMessage(
                            user.phoneNumber,
                            '❌ Error al realizar el diagnóstico de conexión. Por favor, intenta nuevamente más tarde.'
                        );
                    }
                }
            }
            return true;
        } catch (error: any) {
            session.diagnosticInProgress = false;
            session.diagnosticTaskId = undefined;
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Error interno en el sistema de diagnóstico. Por favor, contacta a soporte técnico.'
            );
            return true;
        }
    }    /**
     * Verifica el resultado del ping usando la API de WispHub
     */
    private async checkPingResult(user: User, session: SessionData, retryCount: number = 0): Promise<void> {
        const maxRetries = 5; // Máximo 5 reintentos (total ~3 minutos)
        const retryDelay = 30000; // 30 segundos entre reintentos

        if (!session.diagnosticTaskId) {
            session.diagnosticInProgress = false;
            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ No se pudo completar el diagnóstico. Por favor, intenta nuevamente.'
            );
            return;
        } try {
            console.log(`[IPDiagnostic] Verificando resultado del ping. Intento: ${retryCount + 1}/${maxRetries + 1}`);

            // Consultar el estado de la tarea usando la API de WispHub
            const taskResponse = await axios.get(
                `${config.wisphub.baseUrl}tasks/${session.diagnosticTaskId}/`,
                {
                    headers: {
                        'Authorization': config.wisphub.apiKey
                    },
                    timeout: 10000
                }
            );

            console.log(`[IPDiagnostic] Respuesta de la tarea:`, taskResponse.status, taskResponse.data);

            const taskData: WispHubTaskResponse = taskResponse.data; if (taskData.task.status === 'SUCCESS') {
                // Procesar y mostrar el resultado exitoso                console.log(`[IPDiagnostic] Tarea completada exitosamente`);
                console.log(`[IPDiagnostic] Resultado completo:`, JSON.stringify(taskData.task.result, null, 2));
                await this.showPingResults(user, taskData, session);
            } else if (taskData.task.status === 'PENDING' || taskData.task.status === 'RUNNING' || taskData.task.status === 'STARTED') {
                // La tarea aún está en proceso
                if (retryCount < maxRetries) {
                    console.log(`[IPDiagnostic] Tarea aún en proceso (${taskData.task.status}). Esperando...`);

                    // Solo enviar mensaje de espera en ciertos reintentos para no saturar
                    if (retryCount === 1 || retryCount === 3) {
                        await this.messageService.sendTextMessage(
                            user.phoneNumber,
                            '⏳ El diagnóstico aún está en proceso. Espera un poco más...'
                        );
                    }

                    // Esperar antes del siguiente intento
                    setTimeout(() => this.checkPingResult(user, session, retryCount + 1), retryDelay);
                    return;
                } else {
                    // Se agotaron los reintentos
                    console.log(`[IPDiagnostic] Se agotaron los reintentos para la tarea`);
                    await this.messageService.sendTextMessage(
                        user.phoneNumber,
                        '⏰ El diagnóstico está tomando más tiempo del esperado.\n\n' +
                        'Esto puede indicar:\n' +
                        '• El servidor está muy ocupado\n' +
                        '• Tu conexión puede estar experimentando problemas\n\n' +
                        'Por favor, intenta nuevamente en unos minutos o contacta a soporte técnico.'
                    );
                }
            } else {
                // La tarea falló o tiene un estado desconocido
                console.log(`[IPDiagnostic] La tarea falló o tiene estado desconocido: ${taskData.task.status}`);
                await this.messageService.sendTextMessage(
                    user.phoneNumber,
                    `❌ El diagnóstico de conexión falló (Estado: ${taskData.task.status}). Por favor, intenta nuevamente más tarde.`
                );
            }
        } catch (error: any) {
            console.error(`[IPDiagnostic] Error al verificar resultado del ping:`, error.message);

            // Si es un error de red y no hemos agotado los reintentos, intentar de nuevo
            if (retryCount < maxRetries && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET')) {
                console.warn(`[IPDiagnostic] Reintento ${retryCount + 1}/${maxRetries} para verificar resultado del ping:`, error.message);
                setTimeout(() => this.checkPingResult(user, session, retryCount + 1), retryDelay);
                return;
            }

            await this.messageService.sendTextMessage(
                user.phoneNumber,
                '❌ Error al verificar el resultado del diagnóstico. Por favor, intenta nuevamente más tarde.'
            );
        }        // Finalizar el proceso de diagnóstico
        session.diagnosticInProgress = false;
        session.diagnosticTaskId = undefined;
        console.log(`[IPDiagnostic] 🏁 Proceso de diagnóstico finalizado para usuario ${user.phoneNumber}`);
    }/**
     * Muestra los resultados del ping al usuario
     */
    private async showPingResults(user: User, taskData: WispHubTaskResponse, session: SessionData): Promise<void> {
        let resultMessage = '✅ Prueba completada\n\n';

        console.log(`[IPDiagnostic] Procesando resultados de ping...`);
        console.log(`[IPDiagnostic] taskData.task.result existe:`, !!taskData.task.result);
        console.log(`[IPDiagnostic] Es array:`, Array.isArray(taskData.task.result));

        if (taskData.task.result && Array.isArray(taskData.task.result)) {
            const pingResults = taskData.task.result;
            console.log(`[IPDiagnostic] Número de elementos en result:`, pingResults.length);            // Log detallado de cada elemento
            pingResults.forEach((item, index) => {
                console.log(`[IPDiagnostic] Elemento ${index}:`, JSON.stringify(item, null, 2));
                // Mostrar también las claves para debug
                console.log(`[IPDiagnostic] Claves del elemento ${index}:`, Object.keys(item));
            });

            // Separar los pings individuales del resumen
            const pingItems = pingResults.filter(item => {
                const keys = Object.keys(item);
                const hasPingKey = keys.some(key => key.startsWith('ping-') && key !== 'ping-exitoso');
                console.log(`[IPDiagnostic] Item keys:`, keys, `hasPingKey:`, hasPingKey);
                return hasPingKey;
            });

            console.log(`[IPDiagnostic] Ping items encontrados:`, pingItems.length);

            const summaryItem = pingResults.find(item => item['ping-exitoso']);
            const summary = summaryItem ? summaryItem['ping-exitoso'] as string : null;

            console.log(`[IPDiagnostic] Summary encontrado:`, summary); if (pingItems.length > 0) {
                // Analizar los resultados de ping
                let successfulPings = 0;
                let totalPings = pingItems.length;
                let totalLatency = 0;
                let pingDetails: string[] = [];

                console.log(`[IPDiagnostic] Analizando ${totalPings} pings...`);

                pingItems.forEach((item, index) => {
                    const pingKey = Object.keys(item).find(key => key.startsWith('ping-'));
                    console.log(`[IPDiagnostic] Procesando ping ${index + 1}, key:`, pingKey);

                    if (pingKey) {
                        const pingData = item[pingKey] as PingDetail;
                        const pingNumber = index + 1;

                        console.log(`[IPDiagnostic] Ping ${pingNumber} data:`, pingData);                        // Analizar el estado del ping - Lógica corregida
                        // Un ping es exitoso si:
                        // 1. El status no contiene errores como "Network is down" o "timeout"
                        // 2. Se recibieron paquetes (received > 0)
                        // 3. El status contiene información de tiempo (como "5ms") o "0 (success)"
                        const isSuccess = pingData.received &&
                            parseInt(pingData.received) > 0 &&
                            !pingData.status.toLowerCase().includes('network is down') &&
                            !pingData.status.toLowerCase().includes('timeout') &&
                            !pingData.status.toLowerCase().includes('unreachable');

                        console.log(`[IPDiagnostic] Ping ${pingNumber} - Status: "${pingData.status}", Received: "${pingData.received}", Success: ${isSuccess}`); if (isSuccess) {
                            successfulPings++;
                            // Intentar extraer tiempo de latencia del status
                            // Buscar patrones como "5ms", "0 (success)", "15ms", etc.
                            const timeMatch = pingData.status.match(/(\d+)\s*ms/) ||
                                pingData.status.match(/(\d+)\s*\(/) ||
                                pingData.status.match(/^(\d+)$/);
                            if (timeMatch) {
                                const latency = parseInt(timeMatch[1]);
                                if (!isNaN(latency)) {
                                    totalLatency += latency;
                                    console.log(`[IPDiagnostic] Ping ${pingNumber} latencia extraída: ${latency}ms`);
                                }
                            }
                        }                        // Formatear detalle del ping con más información
                        const statusEmoji = isSuccess ? '✅' : '❌';
                        let statusText = '';

                        if (isSuccess) {
                            // Para pings exitosos, mostrar información detallada
                            const packetInfo = `${pingData.received}/${pingData.sent} paquetes`;
                            const lossInfo = pingData["packet-loss"] ? ` (pérdida: ${pingData["packet-loss"]})` : '';
                            statusText = `${packetInfo}${lossInfo} - ${pingData.status}`;
                        } else {
                            // Para pings fallidos, mostrar el motivo
                            if (pingData.received === '0' || parseInt(pingData.received) === 0) {
                                statusText = 'Sin respuesta - ' + pingData.status;
                            } else {
                                statusText = `${pingData.received}/${pingData.sent} - ${pingData.status}`;
                            }
                        }

                        pingDetails.push(`${statusEmoji} Ping ${pingNumber}: ${statusText}`);
                    }
                });

                console.log(`[IPDiagnostic] Pings exitosos: ${successfulPings}/${totalPings}`);

                // Mostrar estadísticas generales
                const successRate = Math.round((successfulPings / totalPings) * 100);

                if (successfulPings > 0) {
                    resultMessage += '📶 Estado de conexión: Activa\n';

                    if (totalLatency > 0) {
                        const avgLatency = Math.round(totalLatency / successfulPings);
                        resultMessage += `⏱️ Latencia promedio: ${avgLatency}ms\n`;
                    }

                    resultMessage += `🔄 Paquetes exitosos: ${successfulPings}/${totalPings} (${successRate}%)\n`;

                    if (summary) {
                        resultMessage += `📊 Resumen: ${summary}\n`;
                    }

                    resultMessage += '\n📊 Detalles:\n';
                    pingDetails.forEach(detail => {
                        resultMessage += detail + '\n';
                    });

                    // Evaluación de la calidad de conexión
                    resultMessage += '\n💡 Evaluación: ';
                    if (successRate === 100) {
                        resultMessage += 'Tu conexión funciona perfectamente 🚀';
                    } else if (successRate >= 80) {
                        resultMessage += 'Tu conexión funciona bien con pequeñas pérdidas ✅';
                    } else if (successRate >= 50) {
                        resultMessage += 'Tu conexión tiene problemas intermitentes ⚠️';
                    } else {
                        resultMessage += 'Tu conexión tiene problemas graves 🚨';
                    }
                } else {
                    resultMessage = '❌ Prueba completada: Sin respuesta\n\n';
                    resultMessage += `🔄 Paquetes: 0/${totalPings} recibidos (0%)\n\n`;

                    if (summary) {
                        resultMessage += `📊 Resumen: ${summary}\n\n`;
                    }

                    resultMessage += '⚠️ No se pudo establecer conexión con tu servicio.\n\n';
                    resultMessage += '💡 Recomendaciones:\n';
                    resultMessage += '• Verifica que tu equipo esté encendido\n';
                    resultMessage += '• Reinicia tu router/modem\n';
                    resultMessage += '• Verifica los cables de conexión\n';
                    resultMessage += '• Si el problema persiste, contacta a soporte técnico';
                }
            } else {
                // Si no se encontraron ping items con el formato esperado,
                // intentar un procesamiento alternativo
                console.log(`[IPDiagnostic] No se encontraron ping items válidos, intentando procesamiento alternativo`);

                // Buscar cualquier objeto que contenga información de ping
                const alternativePingData = pingResults.filter(item => {
                    const keys = Object.keys(item);
                    // Buscar claves que contengan información de ping
                    return keys.some(key =>
                        key.includes('ping') ||
                        key.includes('status') ||
                        key.includes('received') ||
                        key.includes('sent')
                    );
                });

                if (alternativePingData.length > 0) {
                    console.log(`[IPDiagnostic] Encontrados ${alternativePingData.length} elementos con datos de ping alternativos`);

                    resultMessage += `⚠️ Se encontraron ${alternativePingData.length} resultados de ping con formato no estándar.\n\n`;

                    alternativePingData.forEach((item, index) => {
                        const keys = Object.keys(item);
                        resultMessage += `📊 Resultado ${index + 1}:\n`;
                        keys.forEach(key => {
                            if (typeof item[key] === 'string' || typeof item[key] === 'number') {
                                resultMessage += `  • ${key}: ${item[key]}\n`;
                            }
                        });
                        resultMessage += '\n';
                    });

                    if (summary) {
                        resultMessage += `📊 Resumen: ${summary}\n`;
                    }
                } else {
                    console.log(`[IPDiagnostic] No se encontraron ping items válidos`);
                    resultMessage += '⚠️ No se obtuvieron resultados de ping válidos.\n';
                    if (summary) {
                        resultMessage += `📊 Información disponible: ${summary}\n`;
                    }
                    resultMessage += 'Para un análisis más detallado, contacta a soporte técnico.';
                }
            }
        } else {
            console.log(`[IPDiagnostic] No hay resultado o no es array`);
            resultMessage += '⚠️ No se obtuvieron detalles específicos del diagnóstico.\n';
            resultMessage += 'Para un análisis más detallado, contacta a soporte técnico.';
        } console.log(`[IPDiagnostic] Mensaje final a enviar:`, resultMessage); try {
            await this.messageService.sendTextMessage(user.phoneNumber, resultMessage);            // Agregar botones de navegación al finalizar el diagnóstico
            await this.messageService.sendNavigationButtons(
                user.phoneNumber,
                '🔄 Diagnóstico Completado',
                '¿Qué te gustaría hacer ahora?'
            );            // Marcar que el diagnóstico ha finalizado
            if (session) {
                session.diagnosticInProgress = false;
                session.flowActive = ''; // Limpiar estado de flujo activo
            }

            console.log(`[IPDiagnostic] ✅ Mensaje enviado exitosamente a ${user.phoneNumber}`);
        } catch (error) {
            console.error(`[IPDiagnostic] ❌ Error enviando mensaje:`, error);
            throw error;
        }
    }

    /**
     * Decodifica los datos del usuario desde la información almacenada
     * Sobrescribe el método de la clase base para adaptarlo a nuestras necesidades
     */
    protected decodeUserData(user: User): any {
        if (!user.customerId) {
            return null;
        }

        try {
            // Intentar usar los datos de servicios del usuario primero
            if (user.userServices && user.userServices.length > 0) {
                const service = user.userServices[0]; // Tomar el primer servicio
                return {
                    id_servicio: service.id,
                    customerName: service.name,
                    status: service.status
                };
            }

            // Intentar usar el método de la clase base si hay datos encriptados
            if (user.encryptedData) {
                const baseData = super.decodeUserData(user);
                if (baseData) {
                    // Los datos ya deberían tener id_servicio desde la autenticación
                    // Si no lo tiene, usar customerId como fallback
                    if (!baseData.id_servicio && baseData.customerId) {
                        baseData.id_servicio = baseData.customerId;
                    }
                    return baseData;
                }
            }

            // Si todo lo demás falla, usar customerId como id_servicio
            return {
                id_servicio: user.customerId,
                customerName: "Usuario",
                status: "unknown"
            };
        } catch (error) {
            console.error('Error decodificando datos de usuario:', error);
            // Fallback final
            return {
                id_servicio: user.customerId,
                customerName: "Usuario",
                status: "unknown"
            };
        }
    }
}
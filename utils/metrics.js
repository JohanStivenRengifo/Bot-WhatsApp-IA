const { register, Counter, Gauge, Histogram } = require('prom-client');

// Contadores
const messageCounter = new Counter({
    name: 'whatsapp_messages_total',
    help: 'Total de mensajes procesados',
    labelNames: ['type', 'flow']
});

const conversationCounter = new Counter({
    name: 'whatsapp_conversations_total',
    help: 'Total de conversaciones iniciadas'
});

const handoverCounter = new Counter({
    name: 'whatsapp_handovers_total',
    help: 'Total de transferencias a agentes humanos'
});

// Medidores
const activeConversationsGauge = new Gauge({
    name: 'whatsapp_active_conversations',
    help: 'Número actual de conversaciones activas'
});

const responseTimeHistogram = new Histogram({
    name: 'whatsapp_response_time_seconds',
    help: 'Tiempo de respuesta del bot',
    buckets: [0.1, 0.5, 1, 2, 5]
});

// Función para actualizar métricas
function updateMetrics(type, value = 1, labels = {}) {
    switch (type) {
        case 'message':
            messageCounter.inc({ type: labels.messageType, flow: labels.flow });
            break;
        case 'conversation':
            conversationCounter.inc();
            break;
        case 'handover':
            handoverCounter.inc();
            break;
        case 'active_conversations':
            activeConversationsGauge.set(value);
            break;
        case 'response_time':
            responseTimeHistogram.observe(value);
            break;
    }
}

// Middleware para exponer métricas
const metricsMiddleware = async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        res.status(500).end(error);
    }
};

module.exports = {
    updateMetrics,
    metricsMiddleware
};

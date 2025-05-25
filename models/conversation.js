// models/conversation.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: { type: String, enum: ['user', 'bot'], required: true },
    content: {
        type: {
            type: String, // 'text', 'interactive', 'template', etc.
            required: true
        },
        id: String,
        title: String,
        body: String, // Para mensajes de texto
        data: mongoose.Schema.Types.Mixed // Para payloads interactivos, listas, etc.
    },
    timestamp: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    userName: String,
    currentFlow: { type: String, default: 'privacy' },
    currentStep: { type: String, required: true },
    hasAcceptedPrivacy: { type: Boolean, default: false },
    userData: { type: mongoose.Schema.Types.Mixed, default: {} },
    messages: [messageSchema],
    lastActivity: { type: Date, default: Date.now },
    isHandedOverToHuman: { type: Boolean, default: false },
    handoverTimestamp: {
        type: Date,
        default: null
    },
    handoverAgent: {
        type: String,
        default: null
    },
    handoverNotes: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contacts', 'interactive'],
        required: true
    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    direction: {
        type: String,
        enum: ['incoming', 'outgoing'],
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
    }
}, {
    timestamps: true
});

// Índices
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index({ messageId: 1 }, { unique: true });
messageSchema.index({ status: 1 });

// Métodos
messageSchema.methods.updateStatus = async function (status, timestamp) {
    this.status = status;
    if (timestamp) {
        this.timestamp = new Date(timestamp * 1000);
    }
    return this.save();
};

messageSchema.methods.markAsRead = async function (timestamp) {
    this.status = 'read';
    if (timestamp) {
        this.timestamp = new Date(timestamp * 1000);
    }
    return this.save();
};

// Métodos estáticos
messageSchema.statics.findByUserId = function (userId, options = {}) {
    const query = { userId };

    if (options.limit) {
        query.limit = options.limit;
    }

    if (options.skip) {
        query.skip = options.skip;
    }

    if (options.type) {
        query.type = options.type;
    }

    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};

messageSchema.statics.findByMessageId = function (messageId) {
    return this.findOne({ messageId });
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 
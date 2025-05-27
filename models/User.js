const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String
    },
    currentFlow: {
        type: String,
        default: 'welcome'
    },
    currentStep: {
        type: String,
        default: 'greeting'
    },
    currentAgent: {
        type: String
    },
    agentTransferTimestamp: {
        type: Date
    },
    receivedCampaigns: [{
        type: String
    }],
    campaignStatus: {
        type: Map,
        of: {
            delivered: Boolean,
            read: Boolean,
            responded: Boolean,
            timestamp: Date
        }
    },
    lastInteraction: {
        type: Date,
        default: Date.now
    },
    preferences: {
        language: {
            type: String,
            default: 'es'
        },
        notifications: {
            type: Boolean,
            default: true
        }
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Índices
userSchema.index({ phoneNumber: 1 });
userSchema.index({ currentFlow: 1 });
userSchema.index({ lastInteraction: -1 });

// Métodos del modelo
userSchema.methods.updateFlow = async function (flowId, stepId) {
    this.currentFlow = flowId;
    this.currentStep = stepId;
    this.lastInteraction = new Date();
    return this.save();
};

userSchema.methods.transferToAgent = async function (agentType) {
    this.currentAgent = agentType;
    this.agentTransferTimestamp = new Date();
    this.lastInteraction = new Date();
    return this.save();
};

userSchema.methods.endAgentConversation = async function () {
    this.currentAgent = null;
    this.agentTransferTimestamp = null;
    this.currentFlow = 'welcome';
    this.currentStep = 'greeting';
    this.lastInteraction = new Date();
    return this.save();
};

userSchema.methods.updateCampaignStatus = async function (campaignId, status) {
    if (!this.campaignStatus) {
        this.campaignStatus = new Map();
    }

    this.campaignStatus.set(campaignId, {
        ...status,
        timestamp: new Date()
    });

    return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User; 
const mongoose = require('mongoose');
const Conversation = require('../models/conversation');
require('dotenv').config();

async function fixMessages() {
    await mongoose.connect(process.env.MONGODB_URI);

    const conversations = await Conversation.find({});
    let totalFixed = 0;

    for (const conv of conversations) {
        let changed = false;
        for (const msg of conv.messages) {
            if (!msg.content || !msg.content.type) {
                if (!msg.content) msg.content = {};
                msg.content.type = 'unknown';
                changed = true;
                totalFixed++;
            }
        }
        if (changed) await conv.save();
    }

    console.log(`Mensajes corregidos: ${totalFixed}`);
    mongoose.disconnect();
}

fixMessages(); 
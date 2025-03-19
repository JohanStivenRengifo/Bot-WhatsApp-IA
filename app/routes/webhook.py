import json
import logging
import requests
from flask import Blueprint, request, jsonify
from datetime import datetime

from app.database import db
from app.models import Customer, Conversation, Message
from app.services.gemini_integration import process_message
from app.services.conversation_flows import handle_conversation_flow
from app.services.ticket_system import create_ticket_from_conversation
from app.services.appointment_scheduler import handle_appointment_request
from app.services.config_service import ConfigService

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create blueprint
webhook_bp = Blueprint('webhook', __name__)

# Get configuration service
config_service = ConfigService()

@webhook_bp.route('/', methods=['GET'])
def verify_webhook():
    """Verify the webhook with WhatsApp Business API"""
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    
    logger.debug(f"Webhook verification: mode={mode}, token={token}, challenge={challenge}")
    
    if mode and token:
        if mode == 'subscribe' and token == config_service.get_webhook_verify_token():
            logger.info("Webhook verified successfully")
            return challenge, 200
        else:
            logger.warning("Webhook verification failed")
            return "Verification failed", 403
    
    return "Bad request", 400

@webhook_bp.route('/', methods=['POST'])
def receive_message():
    """Handle incoming WhatsApp messages"""
    try:
        # Parse the incoming JSON data
        data = json.loads(request.data.decode('utf-8'))
        logger.debug(f"Received webhook data: {data}")
        
        # Check if this is a WhatsApp message notification
        if 'object' in data and data['object'] == 'whatsapp_business_account':
            if 'entry' in data and data['entry']:
                for entry in data['entry']:
                    if 'changes' in entry and entry['changes']:
                        for change in entry['changes']:
                            if 'value' in change and 'messages' in change['value']:
                                # Process each message
                                for message in change['value']['messages']:
                                    process_incoming_message(message)
                
                return jsonify({"status": "success"}), 200
        
        return jsonify({"status": "ignored"}), 200
    
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def process_incoming_message(message):
    """Process an incoming WhatsApp message"""
    try:
        # Extract message details
        message_id = message['id']
        from_number = message['from']
        timestamp = datetime.fromtimestamp(int(message['timestamp']))
        
        # Determine message type and content
        message_type = message['type']
        message_content = ""
        
        if message_type == 'text':
            message_content = message['text']['body']
        elif message_type == 'image':
            message_content = "[Image received]"
            
        # Process the message with AI
        ai_response = process_message(message_content)
        
        # Check for customer in database
        customer = Customer.query.filter_by(phone_number=from_number).first()
        if not customer:
            # Create new customer if not exists
            customer = Customer(phone_number=from_number)
            db.session.add(customer)
            db.session.commit()
        
        # Find or create conversation
        conversation = Conversation.query.filter_by(
            customer_id=customer.id
        ).order_by(Conversation.created_at.desc()).first()
        
        # Create new conversation if none exists or last one is older than 24 hours
        if not conversation or (datetime.now() - conversation.created_at).total_seconds() > 86400:
            conversation = Conversation(customer_id=customer.id)
            db.session.add(conversation)
            db.session.commit()
        
        # Save the message
        new_message = Message(
            conversation_id=conversation.id,
            content=message_content,
            is_from_customer=True,
            message_id=message_id
        )
        db.session.add(new_message)
        db.session.commit()
        
        # Handle conversation flow
        handle_conversation_flow(conversation, message_content)
        
        # Check for appointment requests
        if "appointment" in message_content.lower() or "schedule" in message_content.lower():
            handle_appointment_request(conversation, message_content)
        
        # Check if ticket creation is needed
        if "issue" in message_content.lower() or "problem" in message_content.lower() or "help" in message_content.lower():
            create_ticket_from_conversation(conversation)
            
        logger.info(f"Processed message from {from_number}: {message_content}")
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
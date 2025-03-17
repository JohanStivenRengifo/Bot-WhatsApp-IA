import os
import json
import logging
import requests
from flask import Blueprint, request, jsonify
from datetime import datetime

from database import db
from models import Customer, Conversation, Message
from gemini_integration import process_message
from conversation_flows import handle_conversation_flow
from ticket_system import create_ticket_from_conversation
from appointment_scheduler import handle_appointment_request

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create blueprint
webhook_bp = Blueprint('webhook', __name__)

# WhatsApp API configuration
WHATSAPP_API_URL = os.environ.get("WHATSAPP_API_URL")
WHATSAPP_API_TOKEN = os.environ.get("WHATSAPP_API_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
WEBHOOK_VERIFY_TOKEN = os.environ.get("WEBHOOK_VERIFY_TOKEN")

@webhook_bp.route('/', methods=['GET'])
def verify_webhook():
    """Verify the webhook with WhatsApp Business API"""
    mode = request.args.get('hub.mode')
    token = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')
    
    logger.debug(f"Webhook verification: mode={mode}, token={token}, challenge={challenge}")
    
    if mode and token:
        if mode == 'subscribe' and token == WEBHOOK_VERIFY_TOKEN:
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
            message_content = message.get('image', {}).get('caption', '[Imagen recibida]')
        elif message_type == 'audio':
            message_content = '[Nota de voz recibida]'
        elif message_type == 'document':
            message_content = f"[Documento recibido: {message.get('document', {}).get('filename', 'unknown')}]"
        else:
            message_content = f"[Mensaje de tipo {message_type} recibido]"
        
        logger.info(f"Message from {from_number}: {message_content}")
        
        # Find or create customer
        customer = Customer.query.filter_by(phone_number=from_number).first()
        if not customer:
            customer = Customer(
                phone_number=from_number,
                created_at=datetime.utcnow()
            )
            db.session.add(customer)
            db.session.commit()
            logger.info(f"Created new customer with phone number {from_number}")
        
        # Update last interaction time
        customer.last_interaction = datetime.utcnow()
        db.session.commit()
        
        # Find or create conversation
        active_conversation = Conversation.query.filter_by(
            customer_id=customer.id, 
            status='active'
        ).first()
        
        if not active_conversation:
            session_id = f"{customer.id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            active_conversation = Conversation(
                customer_id=customer.id,
                session_id=session_id,
                started_at=datetime.utcnow(),
                status='active'
            )
            db.session.add(active_conversation)
            db.session.commit()
            logger.info(f"Created new conversation with session ID {session_id}")
        
        # Save message to database
        new_message = Message(
            conversation_id=active_conversation.id,
            message_id=message_id,
            direction='incoming',
            content=message_content,
            timestamp=timestamp
        )
        db.session.add(new_message)
        db.session.commit()
        
        # Process message with Gemini AI
        ai_response = process_message(message_content, customer, active_conversation)
        
        # Handle the conversation flow based on AI analysis
        handle_conversation_flow(
            customer, 
            active_conversation, 
            message_content, 
            ai_response
        )
        
        # Send response back to the customer
        send_whatsapp_message(from_number, ai_response['response_text'])
        
        # Save bot response to database
        bot_message = Message(
            conversation_id=active_conversation.id,
            message_id=f"bot-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            direction='outgoing',
            content=ai_response['response_text'],
            timestamp=datetime.utcnow(),
            intent=ai_response.get('intent'),
            sentiment=ai_response.get('sentiment'),
            entities=ai_response.get('entities')
        )
        db.session.add(bot_message)
        db.session.commit()
        
        # Handle specific actions based on intent
        if ai_response.get('intent') == 'create_ticket':
            create_ticket_from_conversation(customer, active_conversation, ai_response)
        
        elif ai_response.get('intent') == 'schedule_appointment':
            handle_appointment_request(customer, active_conversation, ai_response)
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        if 'from_number' in locals():
            send_whatsapp_message(
                from_number, 
                "Lo siento, estamos experimentando dificultades técnicas. Por favor, inténtalo de nuevo más tarde."
            )

def send_whatsapp_message(to_number, message_content):
    """Send a message via WhatsApp Business API"""
    try:
        headers = {
            'Authorization': f'Bearer {WHATSAPP_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_number,
            "type": "text",
            "text": {
                "body": message_content
            }
        }
        
        url = f"{WHATSAPP_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            logger.info(f"Message sent successfully to {to_number}")
            return True
        else:
            logger.error(f"Failed to send message: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {str(e)}")
        return False

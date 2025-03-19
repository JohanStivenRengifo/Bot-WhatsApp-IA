import logging
import json
from datetime import datetime

from app.database import db
from app.models import Customer, Conversation, Message, Ticket
from app.services.ticket_system import should_create_ticket
from app.services.appointment_scheduler import check_appointment_availability

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Define conversation flow states
FLOW_STATES = {
    'GREETING': 'greeting',
    'PROBLEM_IDENTIFICATION': 'problem_identification',
    'TROUBLESHOOTING': 'troubleshooting',
    'TICKET_CREATION': 'ticket_creation',
    'APPOINTMENT_SCHEDULING': 'appointment_scheduling',
    'INFORMATION_GATHERING': 'information_gathering',
    'CLOSING': 'closing'
}

def handle_conversation_flow(customer, conversation, user_message, ai_response):
    """
    Main function to handle conversation flow based on AI analysis
    and determine next steps
    """
    try:
        # Get or set conversation state
        conversation_state = get_conversation_state(conversation)
        intent = ai_response.get('intent', 'consulta_general')
        entities = ai_response.get('entities', {})
        
        logger.info(f"Current conversation state: {conversation_state}")
        logger.info(f"Detected intent: {intent}")
        
        # Update conversation state based on intent and current state
        new_state = determine_next_state(conversation_state, intent, entities)
        logger.info(f"New conversation state: {new_state}")
        
        # Update conversation state in database
        update_conversation_state(conversation, new_state)
        
        # Check for tickets that need to be created
        if new_state == FLOW_STATES['PROBLEM_IDENTIFICATION'] or new_state == FLOW_STATES['TROUBLESHOOTING']:
            if should_create_ticket(user_message, ai_response):
                logger.info(f"Ticket creation recommended for customer {customer.id}")
                # Note: actual ticket creation is handled in whatsapp_webhook.py when intent is 'create_ticket'
        
        # Check for appointment scheduling
        if new_state == FLOW_STATES['APPOINTMENT_SCHEDULING']:
            # Extract date and time if present in entities
            appointment_date = entities.get('date')
            appointment_time = entities.get('time')
            
            if appointment_date and appointment_time:
                availability = check_appointment_availability(appointment_date, appointment_time)
                logger.info(f"Appointment availability for {appointment_date} at {appointment_time}: {availability}")
        
        return new_state
        
    except Exception as e:
        logger.error(f"Error in conversation flow handling: {str(e)}")
        return FLOW_STATES['GREETING']  # Default to greeting state on error

def get_conversation_state(conversation):
    """Get the current state of a conversation"""
    try:
        # Check if the conversation has a state stored in the last message
        last_message = Message.query.filter_by(conversation_id=conversation.id) \
            .order_by(Message.timestamp.desc()) \
            .first()
        
        if last_message and hasattr(last_message, 'entities') and last_message.entities:
            entities = last_message.entities
            if isinstance(entities, str):
                entities = json.loads(entities)
            
            if entities and 'conversation_state' in entities:
                return entities['conversation_state']
        
        # Default to greeting for new conversations
        return FLOW_STATES['GREETING']
    
    except Exception as e:
        logger.error(f"Error getting conversation state: {str(e)}")
        return FLOW_STATES['GREETING']

def update_conversation_state(conversation, new_state):
    """Update the state of a conversation"""
    try:
        # Get the last message
        last_message = Message.query.filter_by(conversation_id=conversation.id) \
            .order_by(Message.timestamp.desc()) \
            .first()
        
        if last_message and hasattr(last_message, 'entities'):
            entities = last_message.entities
            if isinstance(entities, str):
                entities = json.loads(entities)
            elif entities is None:
                entities = {}
                
            # Update the state
            entities['conversation_state'] = new_state
            
            # Save back to the message
            last_message.entities = entities
            db.session.commit()
            
    except Exception as e:
        logger.error(f"Error updating conversation state: {str(e)}")
        db.session.rollback()

def determine_next_state(current_state, intent, entities):
    """Determine the next conversation state based on intent and current state"""
    # Map intents to states
    intent_state_map = {
        'saludo': FLOW_STATES['GREETING'],
        'despedida': FLOW_STATES['CLOSING'],
        'reporte_falla': FLOW_STATES['PROBLEM_IDENTIFICATION'],
        'solicitud_ayuda': FLOW_STATES['PROBLEM_IDENTIFICATION'],
        'solicitud_cita': FLOW_STATES['APPOINTMENT_SCHEDULING'],
        'consulta_servicio': FLOW_STATES['INFORMATION_GATHERING'],
        'create_ticket': FLOW_STATES['TICKET_CREATION']
    }
    
    # Check if we have a direct mapping for this intent
    if intent in intent_state_map:
        return intent_state_map[intent]
    
    # State transition logic based on current state and intent
    if current_state == FLOW_STATES['GREETING']:
        if 'problema' in intent or 'falla' in intent or 'error' in intent:
            return FLOW_STATES['PROBLEM_IDENTIFICATION']
        elif 'cita' in intent or 'visita' in intent or 'técnico' in intent:
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        else:
            return FLOW_STATES['INFORMATION_GATHERING']
            
    elif current_state == FLOW_STATES['PROBLEM_IDENTIFICATION']:
        if 'solución' in intent or 'resolver' in intent:
            return FLOW_STATES['TROUBLESHOOTING']
        elif 'ticket' in intent or 'reporte' in intent:
            return FLOW_STATES['TICKET_CREATION']
        elif 'cita' in intent or 'visita' in intent or 'técnico' in intent:
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        else:
            return current_state
            
    elif current_state == FLOW_STATES['TROUBLESHOOTING']:
        if 'ticket' in intent or 'reporte' in intent:
            return FLOW_STATES['TICKET_CREATION']
        elif 'cita' in intent or 'visita' in intent or 'técnico' in intent:
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        elif 'gracias' in intent or 'resuelto' in intent or 'solucionado' in intent:
            return FLOW_STATES['CLOSING']
        else:
            return current_state
    
    # Default: stay in current state if no transition is triggered
    return current_state
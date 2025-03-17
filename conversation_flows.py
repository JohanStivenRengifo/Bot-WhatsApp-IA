import logging
import json
from datetime import datetime

from database import db
from models import Customer, Conversation, Message, Ticket
from ticket_system import should_create_ticket
from appointment_scheduler import check_appointment_availability

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
            
            # Update conversation state
            entities['conversation_state'] = new_state
            last_message.entities = entities
            
            db.session.commit()
            logger.info(f"Updated conversation state to {new_state}")
    
    except Exception as e:
        logger.error(f"Error updating conversation state: {str(e)}")

def determine_next_state(current_state, intent, entities):
    """Determine the next conversation state based on intent and current state"""
    # New conversation or greeting
    if current_state == FLOW_STATES['GREETING']:
        if intent in ['reporte_problema', 'solicitud_soporte']:
            return FLOW_STATES['PROBLEM_IDENTIFICATION']
        elif intent == 'solicitud_cita':
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        elif intent == 'consulta_informacion':
            return FLOW_STATES['INFORMATION_GATHERING']
        else:
            return FLOW_STATES['GREETING']
    
    # Problem identification phase
    elif current_state == FLOW_STATES['PROBLEM_IDENTIFICATION']:
        if intent == 'crear_ticket':
            return FLOW_STATES['TICKET_CREATION']
        elif intent == 'solicitud_cita':
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        elif intent == 'solicitud_ayuda':
            return FLOW_STATES['TROUBLESHOOTING']
        else:
            return FLOW_STATES['PROBLEM_IDENTIFICATION']
    
    # Troubleshooting phase
    elif current_state == FLOW_STATES['TROUBLESHOOTING']:
        if intent == 'crear_ticket':
            return FLOW_STATES['TICKET_CREATION']
        elif intent == 'problema_resuelto':
            return FLOW_STATES['CLOSING']
        elif intent == 'solicitud_cita':
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        else:
            return FLOW_STATES['TROUBLESHOOTING']
    
    # Ticket creation phase
    elif current_state == FLOW_STATES['TICKET_CREATION']:
        if intent == 'confirmar_ticket':
            return FLOW_STATES['CLOSING']
        elif intent == 'solicitud_cita':
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        else:
            return FLOW_STATES['TICKET_CREATION']
    
    # Appointment scheduling phase
    elif current_state == FLOW_STATES['APPOINTMENT_SCHEDULING']:
        if intent == 'confirmar_cita':
            return FLOW_STATES['CLOSING']
        elif intent == 'cambiar_fecha':
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
        else:
            return FLOW_STATES['APPOINTMENT_SCHEDULING']
    
    # Information gathering phase
    elif current_state == FLOW_STATES['INFORMATION_GATHERING']:
        if intent == 'consulta_adicional':
            return FLOW_STATES['INFORMATION_GATHERING']
        else:
            return FLOW_STATES['CLOSING']
    
    # Default to current state if no transition is found
    return current_state

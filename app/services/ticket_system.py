import os
import logging
import random
import string
from datetime import datetime
from flask import request, jsonify

from app.database import db
from app.models import Customer, Conversation, Message, Ticket, TicketNote

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def generate_ticket_number():
    """Generate a unique ticket number"""
    prefix = "TKT"
    timestamp = datetime.now().strftime("%Y%m%d")
    random_chars = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}-{timestamp}-{random_chars}"

def should_create_ticket(message_text, ai_response):
    """Determine if a ticket should be created based on message content and AI analysis"""
    # Check intent from AI response
    intent = ai_response.get('intent', '').lower()
    if 'falla' in intent or 'problema' in intent or 'error' in intent or 'ticket' in intent:
        return True
    
    # Check message content for keywords indicating problems
    problem_keywords = ['no funciona', 'problema', 'error', 'falla', 'ayuda', 'roto', 'mal']
    for keyword in problem_keywords:
        if keyword in message_text.lower():
            return True
    
    return False

def create_ticket_from_conversation(customer, conversation, issue_type=None, description=None):
    """Create a support ticket from a conversation"""
    try:
        # Get the last few messages for context
        messages = Message.query.filter_by(conversation_id=conversation.id) \
            .order_by(Message.timestamp.desc()) \
            .limit(5) \
            .all()
        
        # Reverse to get chronological order
        messages.reverse()
        
        # If no description provided, build one from messages
        if not description:
            description = "Ticket creado desde conversación de WhatsApp:\n\n"
            for msg in messages:
                sender = "Cliente" if msg.direction == "incoming" else "Bot"
                description += f"{sender}: {msg.content}\n"
        
        # If no issue type provided, use a default
        if not issue_type:
            issue_type = "Problema técnico"
        
        # Generate ticket number
        ticket_number = generate_ticket_number()
        
        # Create new ticket
        new_ticket = Ticket(
            ticket_number=ticket_number,
            customer_id=customer.id,
            issue_type=issue_type,
            description=description,
            status='open',
            priority='medium',
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(new_ticket)
        db.session.commit()
        
        logger.info(f"Created ticket {ticket_number} for customer {customer.id}")
        
        return new_ticket
        
    except Exception as e:
        logger.error(f"Error creating ticket from conversation: {str(e)}")
        db.session.rollback()
        return None

def get_customer_tickets(customer_id):
    """Get all tickets for a customer"""
    try:
        tickets = Ticket.query.filter_by(customer_id=customer_id) \
            .order_by(Ticket.created_at.desc()) \
            .all()
        
        result = []
        for ticket in tickets:
            result.append({
                'id': ticket.id,
                'ticket_number': ticket.ticket_number,
                'issue_type': ticket.issue_type,
                'status': ticket.status,
                'created_at': ticket.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting customer tickets: {str(e)}")
        return []
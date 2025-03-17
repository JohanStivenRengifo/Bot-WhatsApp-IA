import os
import logging
import random
import string
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify

from database import db
from models import Customer, Conversation, Message, Ticket, TicketNote

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create blueprint
tickets_bp = Blueprint('tickets', __name__)

@tickets_bp.route('/')
def tickets_dashboard():
    """Display tickets dashboard"""
    return render_template('tickets.html')

@tickets_bp.route('/api/tickets')
def get_tickets():
    """API endpoint to get tickets list"""
    try:
        # Get query parameters for filtering
        status = request.args.get('status')
        priority = request.args.get('priority')
        
        # Build query
        query = Ticket.query
        
        if status:
            query = query.filter(Ticket.status == status)
        if priority:
            query = query.filter(Ticket.priority == priority)
        
        # Order by updated date, newest first
        tickets = query.order_by(Ticket.updated_at.desc()).all()
        
        # Format for JSON response
        result = []
        for ticket in tickets:
            customer = Customer.query.get(ticket.customer_id)
            result.append({
                'id': ticket.id,
                'ticket_number': ticket.ticket_number,
                'customer_name': customer.name if customer and customer.name else customer.phone_number,
                'issue_type': ticket.issue_type,
                'description': ticket.description,
                'status': ticket.status,
                'priority': ticket.priority,
                'created_at': ticket.created_at.strftime('%Y-%m-%d %H:%M'),
                'updated_at': ticket.updated_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return jsonify({'tickets': result})
    
    except Exception as e:
        logger.error(f"Error getting tickets: {str(e)}")
        return jsonify({'error': str(e)}), 500

@tickets_bp.route('/api/tickets/<ticket_id>')
def get_ticket_details(ticket_id):
    """API endpoint to get ticket details"""
    try:
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        customer = Customer.query.get(ticket.customer_id)
        notes = TicketNote.query.filter_by(ticket_id=ticket.id).order_by(TicketNote.created_at).all()
        
        # Format notes
        notes_list = []
        for note in notes:
            notes_list.append({
                'id': note.id,
                'content': note.content,
                'created_at': note.created_at.strftime('%Y-%m-%d %H:%M'),
                'user_id': note.user_id
            })
        
        # Format customer data
        customer_data = {
            'id': customer.id,
            'phone_number': customer.phone_number,
            'name': customer.name,
            'email': customer.email,
            'address': customer.address,
            'service_plan': customer.service_plan,
            'account_number': customer.account_number
        }
        
        result = {
            'id': ticket.id,
            'ticket_number': ticket.ticket_number,
            'customer': customer_data,
            'issue_type': ticket.issue_type,
            'description': ticket.description,
            'status': ticket.status,
            'priority': ticket.priority,
            'created_at': ticket.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': ticket.updated_at.strftime('%Y-%m-%d %H:%M'),
            'closed_at': ticket.closed_at.strftime('%Y-%m-%d %H:%M') if ticket.closed_at else None,
            'notes': notes_list
        }
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error getting ticket details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@tickets_bp.route('/api/tickets', methods=['POST'])
def create_ticket():
    """API endpoint to create a new ticket manually"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['customer_id', 'issue_type', 'description']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Generate ticket number
        ticket_number = generate_ticket_number()
        
        # Create new ticket
        new_ticket = Ticket(
            ticket_number=ticket_number,
            customer_id=data['customer_id'],
            issue_type=data['issue_type'],
            description=data['description'],
            status='open',
            priority=data.get('priority', 'medium'),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(new_ticket)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'ticket_id': new_ticket.id,
            'ticket_number': new_ticket.ticket_number
        })
    
    except Exception as e:
        logger.error(f"Error creating ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tickets_bp.route('/api/tickets/<ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    """API endpoint to update a ticket"""
    try:
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        data = request.json
        
        # Update fields
        if 'status' in data:
            ticket.status = data['status']
            # If status is closed, add closed timestamp
            if data['status'] == 'closed' and not ticket.closed_at:
                ticket.closed_at = datetime.utcnow()
        
        if 'priority' in data:
            ticket.priority = data['priority']
        
        if 'description' in data:
            ticket.description = data['description']
        
        # Always update the updated_at timestamp
        ticket.updated_at = datetime.utcnow()
        
        # Add note if provided
        if 'note' in data and data['note']:
            note = TicketNote(
                ticket_id=ticket.id,
                user_id=data.get('user_id'),
                content=data['note'],
                created_at=datetime.utcnow()
            )
            db.session.add(note)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'ticket_id': ticket.id
        })
    
    except Exception as e:
        logger.error(f"Error updating ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def generate_ticket_number():
    """Generate a unique ticket number"""
    prefix = "TKT"
    date_str = datetime.utcnow().strftime("%y%m%d")
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    
    ticket_number = f"{prefix}-{date_str}-{random_str}"
    
    # Check if ticket number already exists
    while Ticket.query.filter_by(ticket_number=ticket_number).first():
        random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        ticket_number = f"{prefix}-{date_str}-{random_str}"
    
    return ticket_number

def should_create_ticket(message_text, ai_response):
    """Determine if a ticket should be created based on message and AI analysis"""
    intent = ai_response.get('intent', '')
    entities = ai_response.get('entities', {})
    urgency = ai_response.get('urgency', 'bajo')
    
    # Automatic ticket creation criteria
    if intent in ['crear_ticket', 'reporte_problema']:
        return True
    
    if urgency in ['alto', 'medio'] and 'problema' in entities:
        return True
    
    # Keywords that indicate a ticket might be needed
    ticket_keywords = [
        'no funciona', 'problema', 'error', 'falla', 'avería', 'roto',
        'sin servicio', 'sin internet', 'sin señal', 'técnico',
        'visita', 'reparación', 'arreglar'
    ]
    
    for keyword in ticket_keywords:
        if keyword in message_text.lower():
            return True
    
    return False

def create_ticket_from_conversation(customer, conversation, ai_response):
    """Create a ticket from a conversation"""
    try:
        # Extract relevant information
        entities = ai_response.get('entities', {})
        issue_type = entities.get('tipo_problema', 'Problema técnico')
        
        # Get the conversation messages for context
        messages = Message.query.filter_by(conversation_id=conversation.id) \
            .order_by(Message.timestamp) \
            .all()
        
        # Build description from conversation
        description = "Ticket creado desde conversación de WhatsApp:\n\n"
        
        # Add last 5 messages or all if less than 5
        count = min(len(messages), 5)
        for i in range(count):
            msg = messages[len(messages) - count + i]
            sender = "Cliente" if msg.direction == "incoming" else "Bot"
            description += f"{sender} ({msg.timestamp.strftime('%H:%M:%S')}): {msg.content}\n"
        
        # Generate ticket number
        ticket_number = generate_ticket_number()
        
        # Determine priority based on AI analysis
        urgency = ai_response.get('urgency', 'bajo')
        priority = 'high' if urgency == 'alto' else 'medium' if urgency == 'medio' else 'low'
        
        # Create ticket
        ticket = Ticket(
            ticket_number=ticket_number,
            customer_id=customer.id,
            issue_type=issue_type,
            description=description,
            status='open',
            priority=priority,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(ticket)
        db.session.commit()
        
        logger.info(f"Created ticket {ticket_number} for customer {customer.id}")
        
        return ticket
    
    except Exception as e:
        logger.error(f"Error creating ticket from conversation: {str(e)}")
        db.session.rollback()
        return None

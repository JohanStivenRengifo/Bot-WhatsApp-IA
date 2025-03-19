import os
import logging
import random
import string
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify

from app.database import db
from app.models import Customer, Conversation, Message, Ticket, TicketNote
from app.services.ticket_system import generate_ticket_number

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
        
        if 'issue_type' in data:
            ticket.issue_type = data['issue_type']
        
        if 'description' in data:
            ticket.description = data['description']
        
        # Add note if provided
        if 'note' in data and data['note']:
            note = TicketNote(
                ticket_id=ticket.id,
                user_id=data.get('user_id'),
                content=data['note'],
                created_at=datetime.utcnow()
            )
            db.session.add(note)
        
        # Update timestamp
        ticket.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'ticket_id': ticket.id,
            'status': ticket.status
        })
    
    except Exception as e:
        logger.error(f"Error updating ticket: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def generate_ticket_number():
    """Generate a unique ticket number"""
    prefix = "TKT"
    timestamp = datetime.now().strftime("%Y%m%d")
    random_chars = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}-{timestamp}-{random_chars}"
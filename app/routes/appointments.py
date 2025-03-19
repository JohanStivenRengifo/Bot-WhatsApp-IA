import logging
import json
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify

from app.database import db
from app.models import Customer, Appointment, Ticket

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create blueprint
appointments_bp = Blueprint('appointments', __name__)

# Define available time slots
TIME_SLOTS = [
    "morning", # 9:00-12:00
    "afternoon", # 12:00-15:00
    "evening" # 15:00-18:00
]

@appointments_bp.route('/')
def appointments_dashboard():
    """Display appointments dashboard"""
    return render_template('appointments.html')

@appointments_bp.route('/api/appointments')
def get_appointments():
    """API endpoint to get appointments list"""
    try:
        # Get query parameters for filtering
        status = request.args.get('status')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # Build query
        query = Appointment.query
        
        if status:
            query = query.filter(Appointment.status == status)
        if date_from:
            date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
            query = query.filter(Appointment.appointment_date >= date_from_obj)
        if date_to:
            date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
            query = query.filter(Appointment.appointment_date <= date_to_obj)
        
        # Order by date and time
        appointments = query.order_by(Appointment.appointment_date, Appointment.appointment_time).all()
        
        # Format for JSON response
        result = []
        for appointment in appointments:
            customer = Customer.query.get(appointment.customer_id)
            ticket = Ticket.query.get(appointment.ticket_id) if appointment.ticket_id else None
            
            result.append({
                'id': appointment.id,
                'customer_name': customer.name if customer and customer.name else customer.phone_number,
                'technician_name': appointment.technician_name,
                'appointment_date': appointment.appointment_date.strftime('%Y-%m-%d'),
                'appointment_time': appointment.appointment_time,
                'status': appointment.status,
                'notes': appointment.notes,
                'ticket_number': ticket.ticket_number if ticket else None
            })
        
        return jsonify({'appointments': result})
    
    except Exception as e:
        logger.error(f"Error getting appointments: {str(e)}")
        return jsonify({'error': str(e)}), 500

@appointments_bp.route('/api/appointments/<appointment_id>')
def get_appointment_details(appointment_id):
    """API endpoint to get appointment details"""
    try:
        appointment = Appointment.query.get(appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
        
        customer = Customer.query.get(appointment.customer_id)
        ticket = Ticket.query.get(appointment.ticket_id) if appointment.ticket_id else None
        
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
        
        # Format ticket data if available
        ticket_data = None
        if ticket:
            ticket_data = {
                'id': ticket.id,
                'ticket_number': ticket.ticket_number,
                'issue_type': ticket.issue_type,
                'status': ticket.status
            }
        
        result = {
            'id': appointment.id,
            'customer': customer_data,
            'ticket': ticket_data,
            'technician_name': appointment.technician_name,
            'appointment_date': appointment.appointment_date.strftime('%Y-%m-%d'),
            'appointment_time': appointment.appointment_time,
            'status': appointment.status,
            'notes': appointment.notes,
            'created_at': appointment.created_at.strftime('%Y-%m-%d %H:%M') if appointment.created_at else None
        }
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error getting appointment details: {str(e)}")
        return jsonify({'error': str(e)}), 500
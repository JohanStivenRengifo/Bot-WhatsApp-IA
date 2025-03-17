import logging
import json
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify

from database import db
from models import Customer, Appointment, Ticket

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
                'description': ticket.description,
                'status': ticket.status
            }
        
        result = {
            'id': appointment.id,
            'customer': customer_data,
            'technician_name': appointment.technician_name,
            'appointment_date': appointment.appointment_date.strftime('%Y-%m-%d'),
            'appointment_time': appointment.appointment_time,
            'status': appointment.status,
            'notes': appointment.notes,
            'ticket': ticket_data,
            'created_at': appointment.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': appointment.updated_at.strftime('%Y-%m-%d %H:%M')
        }
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error getting appointment details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@appointments_bp.route('/api/appointments', methods=['POST'])
def create_appointment():
    """API endpoint to create a new appointment"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['customer_id', 'appointment_date', 'appointment_time']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Parse date
        try:
            appointment_date = datetime.strptime(data['appointment_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Validate time slot
        if data['appointment_time'] not in TIME_SLOTS:
            return jsonify({'error': f'Invalid time slot. Use one of: {", ".join(TIME_SLOTS)}'}), 400
        
        # Check availability
        if not is_slot_available(appointment_date, data['appointment_time']):
            return jsonify({'error': 'This time slot is not available'}), 400
        
        # Create new appointment
        new_appointment = Appointment(
            customer_id=data['customer_id'],
            ticket_id=data.get('ticket_id'),
            technician_name=data.get('technician_name'),
            appointment_date=appointment_date,
            appointment_time=data['appointment_time'],
            status='scheduled',
            notes=data.get('notes', ''),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(new_appointment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'appointment_id': new_appointment.id
        })
    
    except Exception as e:
        logger.error(f"Error creating appointment: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@appointments_bp.route('/api/appointments/<appointment_id>', methods=['PUT'])
def update_appointment(appointment_id):
    """API endpoint to update an appointment"""
    try:
        appointment = Appointment.query.get(appointment_id)
        if not appointment:
            return jsonify({'error': 'Appointment not found'}), 404
        
        data = request.json
        
        # Update fields
        if 'status' in data:
            appointment.status = data['status']
        
        if 'technician_name' in data:
            appointment.technician_name = data['technician_name']
        
        if 'notes' in data:
            appointment.notes = data['notes']
        
        if 'appointment_date' in data and 'appointment_time' in data:
            # Parse date
            try:
                new_date = datetime.strptime(data['appointment_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
            
            # Validate time slot
            if data['appointment_time'] not in TIME_SLOTS:
                return jsonify({'error': f'Invalid time slot. Use one of: {", ".join(TIME_SLOTS)}'}), 400
            
            # Check if this is a different date/time than currently scheduled
            if (new_date != appointment.appointment_date or 
                data['appointment_time'] != appointment.appointment_time):
                
                # Check availability
                if not is_slot_available(new_date, data['appointment_time'], exclude_appointment_id=appointment.id):
                    return jsonify({'error': 'This time slot is not available'}), 400
                
                # Update with new date/time
                appointment.appointment_date = new_date
                appointment.appointment_time = data['appointment_time']
        
        # Always update the updated_at timestamp
        appointment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'appointment_id': appointment.id
        })
    
    except Exception as e:
        logger.error(f"Error updating appointment: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@appointments_bp.route('/api/availability')
def check_availability():
    """API endpoint to check availability of time slots for a date range"""
    try:
        # Get date range
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        if not date_from or not date_to:
            return jsonify({'error': 'Both date_from and date_to are required'}), 400
        
        try:
            date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
            date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Limit range to 14 days maximum
        if (date_to_obj - date_from_obj).days > 14:
            return jsonify({'error': 'Date range cannot exceed 14 days'}), 400
        
        # Get existing appointments in date range
        appointments = Appointment.query.filter(
            Appointment.appointment_date >= date_from_obj,
            Appointment.appointment_date <= date_to_obj
        ).all()
        
        # Build availability map
        availability = {}
        current_date = date_from_obj
        while current_date <= date_to_obj:
            # Skip weekends (0=Monday, 6=Sunday in Python's date.weekday())
            if current_date.weekday() < 5:  # Monday to Friday
                date_str = current_date.strftime('%Y-%m-%d')
                availability[date_str] = {
                    'morning': True,
                    'afternoon': True,
                    'evening': True
                }
            
            current_date += timedelta(days=1)
        
        # Mark booked slots as unavailable
        for appointment in appointments:
            date_str = appointment.appointment_date.strftime('%Y-%m-%d')
            if date_str in availability:
                availability[date_str][appointment.appointment_time] = False
        
        return jsonify({'availability': availability})
    
    except Exception as e:
        logger.error(f"Error checking availability: {str(e)}")
        return jsonify({'error': str(e)}), 500

def is_slot_available(date, time_slot, exclude_appointment_id=None):
    """Check if a specific time slot is available on a date"""
    try:
        # Skip weekends
        if date.weekday() >= 5:  # 5=Saturday, 6=Sunday
            return False
        
        # Get appointments for this date and time slot
        query = Appointment.query.filter(
            Appointment.appointment_date == date,
            Appointment.appointment_time == time_slot,
            Appointment.status != 'cancelled'  # Ignore cancelled appointments
        )
        
        # Exclude the appointment we're updating if provided
        if exclude_appointment_id:
            query = query.filter(Appointment.id != exclude_appointment_id)
        
        # Check if any appointment exists for this slot
        existing_appointment = query.first()
        
        return existing_appointment is None
    
    except Exception as e:
        logger.error(f"Error checking slot availability: {str(e)}")
        return False

def check_appointment_availability(date_str, time_slot):
    """Check availability for a specific date and time slot"""
    try:
        # Parse date
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            # Try to parse other common date formats
            try:
                date = datetime.strptime(date_str, '%d/%m/%Y').date()
            except ValueError:
                try:
                    date = datetime.strptime(date_str, '%d-%m-%Y').date()
                except ValueError:
                    return {'available': False, 'error': 'Invalid date format'}
        
        # Map time slot descriptions to our internal values
        time_mapping = {
            'mañana': 'morning',
            'manana': 'morning',
            'morning': 'morning',
            'tarde': 'afternoon',
            'afternoon': 'afternoon',
            'noche': 'evening',
            'evening': 'evening',
            'tarde-noche': 'evening'
        }
        
        normalized_time = time_mapping.get(time_slot.lower())
        if not normalized_time:
            return {
                'available': False, 
                'error': f'Invalid time slot. Use one of: {", ".join(TIME_SLOTS)}'
            }
        
        # Check if slot is available
        available = is_slot_available(date, normalized_time)
        
        return {
            'available': available,
            'date': date_str,
            'time_slot': normalized_time
        }
    
    except Exception as e:
        logger.error(f"Error checking appointment availability: {str(e)}")
        return {'available': False, 'error': str(e)}

def handle_appointment_request(customer, conversation, ai_response):
    """Handle appointment scheduling request from WhatsApp conversation"""
    try:
        # Extract date and time from entities
        entities = ai_response.get('entities', {})
        date_str = entities.get('date')
        time_slot = entities.get('time')
        
        # If we don't have date or time, we'll need more information
        if not date_str or not time_slot:
            logger.info(f"Incomplete appointment request, missing date or time")
            return {
                'success': False,
                'message': 'Faltan datos para la cita (fecha o hora)'
            }
        
        # Check availability
        availability = check_appointment_availability(date_str, time_slot)
        
        if not availability['available']:
            logger.info(f"Appointment slot not available: {date_str} at {time_slot}")
            return {
                'success': False,
                'message': f"Horario no disponible: {availability.get('error', 'Hora ocupada')}"
            }
        
        # Parse date into datetime object
        try:
            appointment_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            try:
                appointment_date = datetime.strptime(date_str, '%d/%m/%Y').date()
            except ValueError:
                try:
                    appointment_date = datetime.strptime(date_str, '%d-%m-%Y').date()
                except ValueError:
                    logger.error(f"Could not parse date: {date_str}")
                    return {
                        'success': False,
                        'message': 'Formato de fecha no válido'
                    }
        
        # Get existing ticket if available
        ticket_id = None
        ticket_number = entities.get('ticket_number')
        if ticket_number:
            ticket = Ticket.query.filter_by(ticket_number=ticket_number).first()
            if ticket:
                ticket_id = ticket.id
        
        # Create appointment
        appointment = Appointment(
            customer_id=customer.id,
            ticket_id=ticket_id,
            appointment_date=appointment_date,
            appointment_time=availability['time_slot'],
            status='scheduled',
            notes=entities.get('problem_description', ''),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(appointment)
        db.session.commit()
        
        logger.info(f"Created appointment for customer {customer.id} on {date_str} at {availability['time_slot']}")
        
        return {
            'success': True,
            'appointment_id': appointment.id,
            'date': date_str,
            'time_slot': availability['time_slot']
        }
    
    except Exception as e:
        logger.error(f"Error handling appointment request: {str(e)}")
        db.session.rollback()
        return {
            'success': False,
            'message': 'Error al programar la cita'
        }

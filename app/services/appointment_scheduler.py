import logging
import random
from datetime import datetime, timedelta

from app.database import db
from app.models import Customer, Appointment, Ticket

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Define available time slots
TIME_SLOTS = {
    'morning': '09:00-12:00',
    'afternoon': '12:00-15:00',
    'evening': '15:00-18:00'
}

def check_appointment_availability(date_str, time_slot):
    """Check if a time slot is available on a given date"""
    try:
        # Parse date string to date object
        if isinstance(date_str, str):
            try:
                # Try different date formats
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y']:
                    try:
                        date_obj = datetime.strptime(date_str, fmt).date()
                        break
                    except ValueError:
                        continue
            except Exception:
                logger.error(f"Could not parse date: {date_str}")
                return False
        else:
            date_obj = date_str
        
        # Normalize time slot
        time_slot = time_slot.lower()
        if 'mañana' in time_slot or 'manana' in time_slot:
            time_slot = 'morning'
        elif 'tarde' in time_slot and 'noche' in time_slot:
            time_slot = 'evening'
        elif 'tarde' in time_slot:
            time_slot = 'afternoon'
        
        # Get the time range for the slot
        time_range = TIME_SLOTS.get(time_slot)
        if not time_range:
            logger.error(f"Invalid time slot: {time_slot}")
            return False
        
        # Check if there are already appointments in this slot
        existing_appointments = Appointment.query.filter(
            Appointment.appointment_date == date_obj,
            Appointment.appointment_time == time_range
        ).count()
        
        # Assume we can handle 3 appointments per time slot
        return existing_appointments < 3
        
    except Exception as e:
        logger.error(f"Error checking appointment availability: {str(e)}")
        return False

def create_appointment(customer, date_str, time_slot, ticket=None, notes=None):
    """Create a new appointment"""
    try:
        # Parse date string to date object
        if isinstance(date_str, str):
            try:
                # Try different date formats
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y']:
                    try:
                        date_obj = datetime.strptime(date_str, fmt).date()
                        break
                    except ValueError:
                        continue
            except Exception:
                logger.error(f"Could not parse date: {date_str}")
                return None
        else:
            date_obj = date_str
        
        # Normalize time slot
        time_slot = time_slot.lower()
        if 'mañana' in time_slot or 'manana' in time_slot:
            time_slot = 'morning'
        elif 'tarde' in time_slot and 'noche' in time_slot:
            time_slot = 'evening'
        elif 'tarde' in time_slot:
            time_slot = 'afternoon'
        
        # Get the time range for the slot
        time_range = TIME_SLOTS.get(time_slot)
        if not time_range:
            logger.error(f"Invalid time slot: {time_slot}")
            return None
        
        # Check availability
        if not check_appointment_availability(date_obj, time_slot):
            logger.error(f"No availability for {date_obj} at {time_slot}")
            return None
        
        # Create new appointment
        new_appointment = Appointment(
            customer_id=customer.id,
            ticket_id=ticket.id if ticket else None,
            technician_name=f"Técnico {random.randint(1, 10)}",  # Random assignment for demo
            appointment_date=date_obj,
            appointment_time=time_range,
            status='scheduled',
            notes=notes or "Cita programada a través del asistente virtual",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(new_appointment)
        db.session.commit()
        
        logger.info(f"Created appointment for customer {customer.id} on {date_obj} at {time_range}")
        
        return new_appointment
        
    except Exception as e:
        logger.error(f"Error creating appointment: {str(e)}")
        db.session.rollback()
        return None

def handle_appointment_request(customer, date_str, time_slot, ticket_id=None):
    """Handle an appointment request from a conversation"""
    try:
        # Check if date and time are valid
        if not date_str or not time_slot:
            return {
                'success': False,
                'message': 'Fecha u horario no especificados'
            }
        
        # Check availability
        if not check_appointment_availability(date_str, time_slot):
            return {
                'success': False,
                'message': f'No hay disponibilidad para la fecha {date_str} en el horario {time_slot}'
            }
        
        # Get ticket if provided
        ticket = None
        if ticket_id:
            ticket = Ticket.query.get(ticket_id)
        
        # Create appointment
        appointment = create_appointment(customer, date_str, time_slot, ticket)
        
        if appointment:
            return {
                'success': True,
                'appointment_id': appointment.id,
                'date': appointment.appointment_date.strftime('%Y-%m-%d'),
                'time': appointment.appointment_time,
                'message': f'Cita programada para el {appointment.appointment_date.strftime("%d/%m/%Y")} en el horario {appointment.appointment_time}'
            }
        else:
            return {
                'success': False,
                'message': 'Error al crear la cita'
            }
            
    except Exception as e:
        logger.error(f"Error handling appointment request: {str(e)}")
        return {
            'success': False,
            'message': 'Error al procesar la solicitud de cita'
        }
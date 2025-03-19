# Initialize the models package
from app.models.models import User, Customer, Ticket, TicketNote, Appointment, Conversation, Message, Settings

# Export all models
__all__ = ['User', 'Customer', 'Ticket', 'TicketNote', 'Appointment', 'Conversation', 'Message', 'Settings']
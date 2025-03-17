from datetime import datetime
from database import db
from flask_login import UserMixin

class User(UserMixin, db.Model):
    """User model for authentication and tracking"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tickets = db.relationship('Ticket', backref='created_by', lazy=True)
    appointments = db.relationship('Appointment', backref='created_by', lazy=True)

class Customer(db.Model):
    """Customer model for storing CRM information"""
    id = db.Column(db.Integer, primary_key=True)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120))
    address = db.Column(db.String(200))
    service_plan = db.Column(db.String(50))
    account_number = db.Column(db.String(20), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_interaction = db.Column(db.DateTime)
    
    # Relationships
    tickets = db.relationship('Ticket', backref='customer', lazy=True)
    appointments = db.relationship('Appointment', backref='customer', lazy=True)
    conversations = db.relationship('Conversation', backref='customer', lazy=True)

class Ticket(db.Model):
    """Ticket model for tracking support issues"""
    id = db.Column(db.Integer, primary_key=True)
    ticket_number = db.Column(db.String(20), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    issue_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='open', nullable=False)
    priority = db.Column(db.String(20), default='medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = db.Column(db.DateTime)
    
    # Relationships
    appointments = db.relationship('Appointment', backref='ticket', lazy=True)
    notes = db.relationship('TicketNote', backref='ticket', lazy=True)

class TicketNote(db.Model):
    """Notes on tickets for tracking conversation and updates"""
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref='ticket_notes')

class Appointment(db.Model):
    """Appointment model for scheduling technician visits"""
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'))
    created_by_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    technician_name = db.Column(db.String(100))
    appointment_date = db.Column(db.Date, nullable=False)
    appointment_time = db.Column(db.String(10), nullable=False)  # Format: HH:MM
    status = db.Column(db.String(20), default='scheduled', nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Conversation(db.Model):
    """Conversation model to store WhatsApp chat history"""
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    session_id = db.Column(db.String(50), unique=True, nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='active')
    
    # Relationships
    messages = db.relationship('Message', backref='conversation', lazy=True)

class Message(db.Model):
    """Message model to store individual WhatsApp messages"""
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    message_id = db.Column(db.String(50), unique=True, nullable=False)
    direction = db.Column(db.String(10), nullable=False)  # 'incoming' or 'outgoing'
    content = db.Column(db.Text, nullable=False)
    media_url = db.Column(db.String(255))
    media_type = db.Column(db.String(20))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # AI analysis fields
    intent = db.Column(db.String(50))
    sentiment = db.Column(db.String(20))
    entities = db.Column(db.JSON)

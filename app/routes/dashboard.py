from flask import Blueprint, jsonify, request
from flask_cors import CORS
from app.models import Conversation, Ticket, Appointment
from datetime import datetime, timedelta
from sqlalchemy import func
from app.services.system_monitor import SystemMonitor

dashboard_bp = Blueprint('dashboard', __name__)
CORS(dashboard_bp)

@dashboard_bp.route('/api/system/status', methods=['GET'])
def get_system_status():
    monitor = SystemMonitor()
    return jsonify(monitor.get_system_status())

@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    try:
        # Get system status
        monitor = SystemMonitor()
        system_status = monitor.get_system_status()
        
        # Get today's date
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())

        # Get conversations today
        conversations_today = Conversation.query.filter(
            Conversation.created_at.between(today_start, today_end)
        ).count()

        # Get active conversations
        active_conversations = Conversation.query.filter(
            Conversation.status == 'active'
        ).count()

        # Get tickets created today
        tickets_created = Ticket.query.filter(
            Ticket.created_at.between(today_start, today_end)
        ).count()

        # Get appointments scheduled today
        appointments_scheduled = Appointment.query.filter(
            Appointment.created_at.between(today_start, today_end)
        ).count()

        # Get ticket status distribution
        ticket_status = Ticket.query.with_entities(
            Ticket.status,
            func.count(Ticket.id).label('count')
        ).group_by(Ticket.status).all()

        ticket_status_data = {
            status: count for status, count in ticket_status
        }

        # Get daily conversations for the last 7 days
        seven_days_ago = today - timedelta(days=6)
        daily_conversations = Conversation.query.with_entities(
            func.date(Conversation.created_at).label('date'),
            func.count(Conversation.id).label('count')
        ).filter(
            Conversation.created_at >= seven_days_ago
        ).group_by(
            func.date(Conversation.created_at)
        ).order_by(
            func.date(Conversation.created_at)
        ).all()

        conversations_by_day = [
            {
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            } for date, count in daily_conversations
        ]

        return jsonify({
            'conversationsToday': conversations_today,
            'ticketsCreated': tickets_created,
            'appointmentsScheduled': appointments_scheduled,
            'activeConversations': active_conversations,
            'ticketStatus': ticket_status_data,
            'conversationsByDay': conversations_by_day
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
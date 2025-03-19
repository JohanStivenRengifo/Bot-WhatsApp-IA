from flask import Blueprint, jsonify, request
from flask_cors import CORS
from app.models import Conversation, Ticket, Appointment, Message
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import db

analytics_bp = Blueprint('analytics', __name__)
CORS(analytics_bp)

@analytics_bp.route('/api/analytics', methods=['GET'])
def get_analytics_data():
    try:
        time_range = request.args.get('timeRange', 'week')
        
        # Calculate date range
        end_date = datetime.now()
        if time_range == 'week':
            start_date = end_date - timedelta(days=7)
            interval = 'day'
        elif time_range == 'month':
            start_date = end_date - timedelta(days=30)
            interval = 'day'
        else:  # year
            start_date = end_date - timedelta(days=365)
            interval = 'month'

        # Get conversation statistics with daily/monthly breakdown
        conversations_over_time = db.session.query(
            func.date_trunc(interval, Conversation.started_at).label('date'),
            func.count(Conversation.id).label('count')
        ).filter(
            Conversation.started_at.between(start_date, end_date)
        ).group_by('date').order_by('date').all()

        # Get ticket statistics with status breakdown
        tickets_by_status = db.session.query(
            Ticket.status,
            func.count(Ticket.id).label('count')
        ).filter(
            Ticket.created_at.between(start_date, end_date)
        ).group_by(Ticket.status).all()

        # Get appointment statistics
        total_appointments = Appointment.query.filter(
            Appointment.created_at.between(start_date, end_date)
        ).count()
        
        previous_period_appointments = Appointment.query.filter(
            Appointment.created_at.between(
                start_date - timedelta(days=(end_date - start_date).days),
                start_date
            )
        ).count()
        
        appointment_trend = calculate_trend(total_appointments, previous_period_appointments)

        # Calculate average response time
        response_times = db.session.query(
            func.avg(
                func.extract('epoch', Message.timestamp) -
                func.extract('epoch', Conversation.started_at)
            )
        ).join(Conversation).filter(
            Message.direction == 'outgoing',
            Message.timestamp.between(start_date, end_date)
        ).scalar()

        previous_response_times = db.session.query(
            func.avg(
                func.extract('epoch', Message.timestamp) -
                func.extract('epoch', Conversation.started_at)
            )
        ).join(Conversation).filter(
            Message.direction == 'outgoing',
            Message.timestamp.between(
                start_date - timedelta(days=(end_date - start_date).days),
                start_date
            )
        ).scalar()

        response_time_trend = calculate_trend(response_times or 0, previous_response_times or 0)

        # Get top issues
        top_issues = db.session.query(
            Ticket.issue_type,
            func.count(Ticket.id).label('count')
        ).filter(
            Ticket.created_at.between(start_date, end_date)
        ).group_by(Ticket.issue_type).order_by(func.count(Ticket.id).desc()).limit(5).all()

        return jsonify({
            'conversationStats': {
                'total': sum(item[1] for item in conversations_over_time),
                'timeline': [{
                    'date': item[0].strftime('%Y-%m-%d'),
                    'count': item[1]
                } for item in conversations_over_time]
            },
            'ticketStats': {
                'total': sum(item[1] for item in tickets_by_status),
                'byStatus': [{
                    'status': status,
                    'count': count
                } for status, count in tickets_by_status]
            },
            'responseTime': {
                'average': round(response_times / 60 if response_times else 0, 1),  # Convert to minutes
                'trend': response_time_trend
            },
            'topIssues': [{
                'issue': issue,
                'count': count
            } for issue, count in top_issues]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def calculate_trend(current, previous):
    if previous == 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100, 1)
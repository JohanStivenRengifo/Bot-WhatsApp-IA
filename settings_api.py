from flask import Blueprint, jsonify, request
from models import Settings
from database import db

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    settings = Settings.get_settings()
    return jsonify(settings.to_dict())

@settings_bp.route('/api/settings', methods=['POST'])
def update_settings():
    try:
        data = request.get_json()
        settings = Settings.get_settings()
        
        # Update WhatsApp settings
        whatsapp = data.get('whatsapp', {})
        settings.whatsapp_api_token = whatsapp.get('apiToken')
        settings.whatsapp_phone_number_id = whatsapp.get('phoneNumberId')
        settings.whatsapp_webhook_verify_token = whatsapp.get('webhookVerifyToken')
        
        # Update Gemini settings
        gemini = data.get('gemini', {})
        settings.gemini_api_key = gemini.get('apiKey')
        settings.gemini_model = gemini.get('model')
        
        # Update Database settings
        database = data.get('database', {})
        settings.database_url = database.get('url')
        
        # Update Notification settings
        notifications = data.get('notifications', {})
        settings.notifications_email_alerts = notifications.get('emailAlerts')
        settings.notifications_email_recipients = notifications.get('emailRecipients')
        
        db.session.commit()
        return jsonify({'message': 'Settings updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
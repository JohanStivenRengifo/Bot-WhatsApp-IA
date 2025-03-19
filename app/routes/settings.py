from flask import Blueprint, jsonify, request
from app.models import Settings
from app.database import db

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
        settings.whatsapp_api_url = whatsapp.get('apiUrl', settings.whatsapp_api_url)
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
        
        # Update CRM settings
        crm = data.get('crm', {})
        settings.crm_api_url = crm.get('apiUrl')
        settings.crm_api_key = crm.get('apiKey')
        
        # Update Session settings
        session = data.get('session', {})
        settings.session_secret = session.get('secret', settings.session_secret)
        
        db.session.commit()
        
        # Reload configuration service to apply changes immediately
        from app.services.config_service import ConfigService
        ConfigService().reload_settings()
        
        return jsonify({'message': 'Settings updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
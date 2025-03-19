import logging
from app.database import db
from app.models import Settings

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ConfigService:
    """Service for managing application configuration from database"""
    
    _instance = None
    _settings = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigService, cls).__new__(cls)
            cls._instance._load_settings()
        return cls._instance
    
    def _load_settings(self):
        """Load settings from database"""
        try:
            self._settings = Settings.get_settings()
            logger.info("Settings loaded from database")
        except Exception as e:
            logger.error(f"Error loading settings: {str(e)}")
            self._settings = None
    
    def reload_settings(self):
        """Reload settings from database"""
        self._load_settings()
        return self._settings is not None
    
    # WhatsApp settings
    def get_whatsapp_api_url(self):
        return self._settings.whatsapp_api_url if self._settings else None
    
    def get_whatsapp_api_token(self):
        return self._settings.whatsapp_api_token if self._settings else None
    
    def get_whatsapp_phone_number_id(self):
        return self._settings.whatsapp_phone_number_id if self._settings else None
    
    def get_webhook_verify_token(self):
        return self._settings.whatsapp_webhook_verify_token if self._settings else None
    
    # Gemini settings
    def get_gemini_api_key(self):
        return self._settings.gemini_api_key if self._settings else None
    
    def get_gemini_model(self):
        return self._settings.gemini_model if self._settings else "gemini-2.0-flash-lite"
    
    # Database settings
    def get_database_url(self):
        return self._settings.database_url if self._settings else None
    
    # Notification settings
    def get_notifications_email_alerts(self):
        return self._settings.notifications_email_alerts if self._settings else False
    
    def get_notifications_email_recipients(self):
        return self._settings.notifications_email_recipients if self._settings else ""
    
    # CRM settings
    def get_crm_api_url(self):
        return self._settings.crm_api_url if self._settings else None
    
    def get_crm_api_key(self):
        return self._settings.crm_api_key if self._settings else None
    
    # Session settings
    def get_session_secret(self):
        return self._settings.session_secret if self._settings else "bot-meta-secret-key"
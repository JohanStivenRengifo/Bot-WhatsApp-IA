import logging
import psycopg2
import google.generativeai as genai
import requests
from app.database import db
from app.services.config_service import ConfigService

class SystemMonitor:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.config_service = ConfigService()
        self.whatsapp_api_url = self.config_service.get_whatsapp_api_url()
        self.whatsapp_token = self.config_service.get_whatsapp_api_token()
        self.gemini_api_key = self.config_service.get_gemini_api_key()
        self.db_url = self.config_service.get_database_url()

    def check_database(self):
        try:
            # Check if database connection is working
            db.session.execute('SELECT 1')
            return {'status': 'ok', 'message': 'Base de datos conectada'}
        except Exception as e:
            self.logger.error(f'Error de conexión a la base de datos: {str(e)}')
            return {'status': 'error', 'message': f'Error de base de datos: {str(e)}'}

    def check_whatsapp_api(self):
        try:
            # Check WhatsApp Business API connection
            headers = {'Authorization': f'Bearer {self.whatsapp_token}'}
            response = requests.get(f'{self.whatsapp_api_url}/health', headers=headers)
            if response.status_code == 200:
                return {'status': 'ok', 'message': 'WhatsApp API conectada'}
            return {'status': 'error', 'message': f'Error de WhatsApp API: {response.status_code}'}
        except Exception as e:
            self.logger.error(f'Error de conexión a WhatsApp API: {str(e)}')
            return {'status': 'error', 'message': f'Error de WhatsApp API: {str(e)}'}

    def check_gemini_api(self):
        try:
            # Check Gemini AI API connection
            genai.configure(api_key=self.gemini_api_key)
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content('test')
            return {'status': 'ok', 'message': 'Gemini AI conectada'}
        except Exception as e:
            self.logger.error(f'Error de conexión a Gemini AI: {str(e)}')
            return {'status': 'error', 'message': f'Error de Gemini AI: {str(e)}'}

    def get_system_status(self):
        db_status = self.check_database()
        whatsapp_status = self.check_whatsapp_api()
        gemini_status = self.check_gemini_api()

        all_ok = all(s['status'] == 'ok' for s in [db_status, whatsapp_status, gemini_status])
        overall_status = 'ok' if all_ok else 'error'

        return {
            'status': overall_status,
            'services': {
                'database': db_status,
                'whatsapp': whatsapp_status,
                'gemini': gemini_status
            }
        }
import logging
import json
from datetime import datetime
import google.generativeai as genai
from app.database import db
from app.models import Customer, Conversation, Message
from app.services.config_service import ConfigService

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Get configuration service
config_service = ConfigService()

# Set up Gemini AI client
genai.configure(api_key=config_service.get_gemini_api_key())

# Initialize the Gemini model
MODEL_NAME = config_service.get_gemini_model()

def get_conversation_history(conversation_id, limit=10):
    """Get recent conversation history for context"""
    messages = Message.query.filter_by(conversation_id=conversation_id) \
        .order_by(Message.timestamp.desc()) \
        .limit(limit) \
        .all()
    
    # Reverse to get chronological order
    messages.reverse()
    
    history = []
    for msg in messages:
        role = "user" if msg.direction == "incoming" else "assistant"
        history.append({"role": role, "content": msg.content})
    
    return history

def build_system_prompt(customer):
    """Build a system prompt based on customer information"""
    system_prompt = """
    Eres un asistente virtual de Conecta2, una empresa de telecomunicaciones especializada en internet y televisión por fibra óptica.
    
    Tu objetivo es ayudar a los clientes con:
    1. Resolver problemas técnicos comunes
    2. Programar visitas técnicas cuando sea necesario
    3. Crear tickets de soporte para problemas complejos
    4. Proporcionar información sobre planes y servicios
    
    Debes ser amable, profesional y eficiente. Comunícate siempre en español.
    
    Cuando identifiques un problema técnico que requiera atención, ofrece crear un ticket de soporte.
    Si el cliente necesita una visita técnica, ayúdale a programar una cita.
    
    Información importante:
    - Nuestro horario de atención es de lunes a viernes de 8:00 AM a 8:00 PM y sábados de 9:00 AM a 2:00 PM
    - Para visitas técnicas, los horarios disponibles son: mañana (9:00-12:00), tarde (12:00-15:00) y tarde-noche (15:00-18:00)
    - Los problemas técnicos comunes incluyen: conectividad intermitente, baja velocidad, configuración de router, y problemas con decodificadores
    
    Responde de manera concisa y directa, pero asegurándote de proporcionar toda la información necesaria.
    """
    
    # Add customer-specific information if available
    if customer:
        system_prompt += "\n\nInformación del cliente:\n"
        if customer.name:
            system_prompt += f"- Nombre: {customer.name}\n"
        if customer.service_plan:
            system_prompt += f"- Plan contratado: {customer.service_plan}\n"
        if customer.account_number:
            system_prompt += f"- Número de cuenta: {customer.account_number}\n"
    
    return system_prompt

def process_message(message_text, customer, conversation):
    """Process a message using Gemini AI and return a response"""
    try:
        # Get conversation history for context
        conversation_history = get_conversation_history(conversation.id)
        
        # Build system prompt
        system_prompt = build_system_prompt(customer)
        
        # Create a chat session
        model = genai.GenerativeModel(model_name=MODEL_NAME)
        chat = model.start_chat(history=[
            {"role": "system", "content": system_prompt},
        ])
        
        # Add conversation history to the chat
        if conversation_history:
            for msg in conversation_history:
                if msg["role"] == "user":
                    chat.send_message(msg["content"])
                # We skip assistant messages as they're already part of the chat history
        
        # Get response from Gemini
        response = chat.send_message(message_text)
        response_text = response.text
        
        # Extract intent, sentiment and entities if available
        try:
            # Ask Gemini to analyze the message
            analysis_prompt = f"""Analiza el siguiente mensaje del cliente y extrae:
            1. La intención principal (intent) como una sola palabra o frase corta (ej: consulta_servicio, reporte_falla, solicitud_cita, etc)
            2. El sentimiento general (sentiment) como: positivo, negativo o neutral
            3. Entidades importantes (entities) como: fechas, horas, nombres, números de cuenta, tipos de problemas, etc.
            
            Mensaje: "{message_text}"
            
            Responde en formato JSON con las claves: intent, sentiment, entities
            """
            
            analysis_response = model.generate_content(analysis_prompt)
            analysis_text = analysis_response.text
            
            # Extract JSON from response
            import re
            json_match = re.search(r'```json\n(.+?)\n```', analysis_text, re.DOTALL)
            if json_match:
                analysis_json = json.loads(json_match.group(1))
            else:
                analysis_json = json.loads(analysis_text)
            
            intent = analysis_json.get('intent', 'consulta_general')
            sentiment = analysis_json.get('sentiment', 'neutral')
            entities = analysis_json.get('entities', {})
            
        except Exception as e:
            logger.error(f"Error analyzing message: {str(e)}")
            intent = 'consulta_general'
            sentiment = 'neutral'
            entities = {}
        
        return {
            'response': response_text,
            'intent': intent,
            'sentiment': sentiment,
            'entities': entities
        }
        
    except Exception as e:
        logger.error(f"Error processing message with Gemini: {str(e)}")
        return {
            'response': "Lo siento, estoy teniendo problemas para procesar tu mensaje. ¿Podrías intentarlo de nuevo o contactar directamente con nuestro equipo de soporte?",
            'intent': 'error',
            'sentiment': 'neutral',
            'entities': {}
        }
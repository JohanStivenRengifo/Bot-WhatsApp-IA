import os
import logging
import json
from datetime import datetime
import google.generativeai as genai
from database import db
from models import Customer, Conversation, Message

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set up Gemini AI client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyAizkVPMrAmdJfS-v5ahlgVp8scOYcLgZE")
genai.configure(api_key=GEMINI_API_KEY)

# Initialize the Gemini model
MODEL_NAME = "gemini-2.0-flash-lite"

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
            analysis_prompt = f"""
            Analiza el siguiente mensaje del cliente y proporciona una respuesta en formato JSON:
            
            Mensaje: "{message_text}"
            
            Proporciona:
            1. "intent": La intención principal (consulta_general, reporte_problema, solicitud_cita, crear_ticket, etc.)
            2. "sentiment": El sentimiento general (positivo, neutral, negativo)
            3. "entities": Entidades importantes como tipo de problema, servicio mencionado, etc.
            4. "urgency": Nivel de urgencia (bajo, medio, alto)
            
            Responde SOLO con el JSON, sin texto adicional.
            """
            
            analysis_response = model.generate_content(analysis_prompt)
            analysis_text = analysis_response.text
            
            # Clean up the response to get valid JSON
            if "```json" in analysis_text:
                analysis_text = analysis_text.split("```json")[1].split("```")[0].strip()
            elif "```" in analysis_text:
                analysis_text = analysis_text.split("```")[1].split("```")[0].strip()
            
            # Parse the JSON
            analysis = json.loads(analysis_text)
            
            logger.info(f"Message analysis: {analysis}")
        except Exception as e:
            logger.error(f"Error analyzing message: {str(e)}")
            analysis = {
                "intent": "consulta_general",
                "sentiment": "neutral",
                "entities": {},
                "urgency": "bajo"
            }
        
        # Return the response with analysis
        return {
            "response_text": response_text,
            "intent": analysis.get("intent"),
            "sentiment": analysis.get("sentiment"),
            "entities": analysis.get("entities"),
            "urgency": analysis.get("urgency")
        }
    
    except Exception as e:
        logger.error(f"Error processing message with Gemini: {str(e)}")
        # Return a fallback response
        return {
            "response_text": "Lo siento, estoy teniendo problemas para procesar tu mensaje. ¿Podrías intentar explicar tu situación de otra manera?",
            "intent": "error",
            "sentiment": "neutral",
            "entities": {},
            "urgency": "bajo"
        }

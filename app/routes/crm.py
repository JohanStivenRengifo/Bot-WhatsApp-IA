from flask import Blueprint, jsonify, request
from flask_cors import CORS
from app.models import Customer, Conversation, Message, Ticket
from app.database import db
from app.services.crm_integration import search_customer_by_phone, create_customer_in_crm, update_customer_in_crm
from app.services.gemini_integration import process_message
from app.services.conversation_flows import handle_conversation_flow
from datetime import datetime
import uuid

crm_bp = Blueprint('crm', __name__)
CORS(crm_bp)

@crm_bp.route('/api/crm/customers', methods=['GET'])
def get_customers():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search_term = request.args.get('search', '')
        
        query = Customer.query
        
        if search_term:
            query = query.filter(
                (Customer.name.ilike(f'%{search_term}%')) |
                (Customer.phone_number.ilike(f'%{search_term}%')) |
                (Customer.email.ilike(f'%{search_term}%'))
            )
        
        pagination = query.order_by(Customer.last_interaction.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        customers = [{
            'id': customer.id,
            'name': customer.name,
            'phone_number': customer.phone_number,
            'email': customer.email,
            'address': customer.address,
            'service_plan': customer.service_plan,
            'account_number': customer.account_number,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
            'last_interaction': customer.last_interaction.isoformat() if customer.last_interaction else None
        } for customer in pagination.items]
        
        return jsonify({
            'customers': customers,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@crm_bp.route('/api/crm/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        
        # Get recent conversations
        recent_conversations = Conversation.query.filter_by(customer_id=customer_id)\
            .order_by(Conversation.started_at.desc()).limit(5).all()
            
        conversations = [{
            'id': conv.id,
            'started_at': conv.started_at.isoformat(),
            'ended_at': conv.ended_at.isoformat() if conv.ended_at else None,
            'status': conv.status
        } for conv in recent_conversations]
        
        # Get recent tickets
        recent_tickets = Ticket.query.filter_by(customer_id=customer_id)\
            .order_by(Ticket.created_at.desc()).limit(5).all()
            
        tickets = [{
            'id': ticket.id,
            'ticket_number': ticket.ticket_number,
            'issue_type': ticket.issue_type,
            'status': ticket.status,
            'created_at': ticket.created_at.isoformat()
        } for ticket in recent_tickets]
        
        return jsonify({
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'phone_number': customer.phone_number,
                'email': customer.email,
                'address': customer.address,
                'service_plan': customer.service_plan,
                'account_number': customer.account_number,
                'created_at': customer.created_at.isoformat() if customer.created_at else None,
                'last_interaction': customer.last_interaction.isoformat() if customer.last_interaction else None
            },
            'recent_conversations': conversations,
            'recent_tickets': tickets
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@crm_bp.route('/api/crm/customers', methods=['POST'])
def create_customer():
    try:
        data = request.get_json()
        
        # Check if customer with this phone number already exists
        existing_customer = Customer.query.filter_by(phone_number=data.get('phone_number')).first()
        if existing_customer:
            return jsonify({'error': 'Customer with this phone number already exists'}), 400
        
        # Create new customer
        new_customer = Customer(
            phone_number=data.get('phone_number'),
            name=data.get('name'),
            email=data.get('email'),
            address=data.get('address'),
            service_plan=data.get('service_plan'),
            account_number=data.get('account_number'),
            created_at=datetime.utcnow()
        )
        
        db.session.add(new_customer)
        db.session.commit()
        
        # Try to create customer in external CRM if integration is enabled
        try:
            create_customer_in_crm(new_customer)
        except Exception as crm_error:
            # Log error but don't fail the request
            print(f"Error creating customer in external CRM: {str(crm_error)}")
        
        return jsonify({
            'id': new_customer.id,
            'name': new_customer.name,
            'phone_number': new_customer.phone_number,
            'message': 'Customer created successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@crm_bp.route('/api/crm/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        # Update customer fields
        if 'name' in data:
            customer.name = data['name']
        if 'email' in data:
            customer.email = data['email']
        if 'address' in data:
            customer.address = data['address']
        if 'service_plan' in data:
            customer.service_plan = data['service_plan']
        if 'account_number' in data:
            customer.account_number = data['account_number']
        
        db.session.commit()
        
        # Try to update customer in external CRM if integration is enabled
        try:
            update_customer_in_crm(customer)
        except Exception as crm_error:
            # Log error but don't fail the request
            print(f"Error updating customer in external CRM: {str(crm_error)}")
        
        return jsonify({
            'id': customer.id,
            'message': 'Customer updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@crm_bp.route('/api/crm/customers/<int:customer_id>/conversations', methods=['GET'])
def get_customer_conversations(customer_id):
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        customer = Customer.query.get_or_404(customer_id)
        
        pagination = Conversation.query.filter_by(customer_id=customer_id)\
            .order_by(Conversation.started_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        conversations = [{
            'id': conv.id,
            'session_id': conv.session_id,
            'started_at': conv.started_at.isoformat(),
            'ended_at': conv.ended_at.isoformat() if conv.ended_at else None,
            'status': conv.status,
            'message_count': len(conv.messages)
        } for conv in pagination.items]
        
        return jsonify({
            'conversations': conversations,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@crm_bp.route('/api/crm/conversations/<int:conversation_id>/messages', methods=['GET'])
def get_conversation_messages(conversation_id):
    try:
        conversation = Conversation.query.get_or_404(conversation_id)
        
        messages = Message.query.filter_by(conversation_id=conversation_id)\
            .order_by(Message.timestamp.asc()).all()
        
        message_list = [{
            'id': msg.id,
            'direction': msg.direction,
            'content': msg.content,
            'media_url': msg.media_url,
            'media_type': msg.media_type,
            'timestamp': msg.timestamp.isoformat(),
            'intent': msg.intent,
            'sentiment': msg.sentiment
        } for msg in messages]
        
        return jsonify({
            'conversation_id': conversation_id,
            'customer_id': conversation.customer_id,
            'started_at': conversation.started_at.isoformat(),
            'status': conversation.status,
            'messages': message_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Nuevos endpoints para la integración del bot con el CRM

@crm_bp.route('/api/crm/start-conversation', methods=['POST'])
def start_conversation():
    try:
        data = request.get_json()
        customer_id = data.get('customer_id')
        
        # Verificar que el cliente existe
        customer = Customer.query.get_or_404(customer_id)
        
        # Crear una nueva conversación
        new_conversation = Conversation(
            customer_id=customer_id,
            session_id=str(uuid.uuid4()),
            started_at=datetime.utcnow(),
            status='active',
            source='crm'
        )
        
        db.session.add(new_conversation)
        db.session.commit()
        
        # Actualizar la última interacción del cliente
        customer.last_interaction = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'conversation_id': new_conversation.id,
            'message': 'Conversación iniciada correctamente'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@crm_bp.route('/api/crm/send-message', methods=['POST'])
def send_message():
    try:
        data = request.get_json()
        customer_id = data.get('customer_id')
        conversation_id = data.get('conversation_id')
        message_content = data.get('message')
        source = data.get('source', 'crm')
        
        # Verificar que el cliente y la conversación existen
        customer = Customer.query.get_or_404(customer_id)
        conversation = Conversation.query.get_or_404(conversation_id)
        
        # Guardar el mensaje del usuario
        user_message = Message(
            conversation_id=conversation_id,
            content=message_content,
            direction='outbound',
            timestamp=datetime.utcnow(),
            source=source
        )
        
        db.session.add(user_message)
        db.session.commit()
        
        # Procesar el mensaje con IA
        ai_response = process_message(message_content, customer_context={
            'name': customer.name,
            'phone_number': customer.phone_number,
            'email': customer.email,
            'service_plan': customer.service_plan
        })
        
        # Manejar el flujo de conversación
        conversation_state = handle_conversation_flow(customer, conversation, message_content, ai_response)
        
        # Guardar la respuesta del bot
        bot_message = Message(
            conversation_id=conversation_id,
            content=ai_response.get('response', 'Lo siento, no pude procesar tu mensaje.'),
            direction='inbound',
            timestamp=datetime.utcnow(),
            intent=ai_response.get('intent'),
            entities=ai_response.get('entities'),
            sentiment=ai_response.get('sentiment'),
            source='bot'
        )
        
        db.session.add(bot_message)
        
        # Actualizar la última interacción del cliente
        customer.last_interaction = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': bot_message.content,
            'intent': bot_message.intent,
            'conversation_state': conversation_state
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
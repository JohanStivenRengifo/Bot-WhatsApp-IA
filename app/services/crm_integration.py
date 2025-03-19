import logging
import requests
import json
from datetime import datetime

from app.database import db
from app.models import Customer
from app.services.config_service import ConfigService

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Get configuration service
config_service = ConfigService()

# CRM API configuration
CRM_API_URL = config_service.get_crm_api_url()
CRM_API_KEY = config_service.get_crm_api_key()

def search_customer_by_phone(phone_number):
    """
    Search for a customer by phone number in the CRM
    Returns customer data if found, None otherwise
    """
    try:
        if not CRM_API_URL or not CRM_API_KEY:
            logger.warning("CRM API not configured, skipping external lookup")
            return None
        
        # Clean phone number (remove spaces, dashes, etc.)
        clean_phone = ''.join(filter(str.isdigit, phone_number))
        
        # Check if customer exists in our local database first
        local_customer = Customer.query.filter_by(phone_number=phone_number).first()
        
        if local_customer and local_customer.account_number:
            # If we already have this customer with an account number, return it
            return {
                "id": local_customer.id,
                "phone_number": local_customer.phone_number,
                "name": local_customer.name,
                "email": local_customer.email,
                "address": local_customer.address,
                "service_plan": local_customer.service_plan,
                "account_number": local_customer.account_number
            }
        
        # If not found locally or missing key data, try to fetch from CRM
        headers = {
            "Authorization": f"Bearer {CRM_API_KEY}",
            "Content-Type": "application/json"
        }
        
        params = {
            "phone": clean_phone
        }
        
        response = requests.get(
            f"{CRM_API_URL}/customers/search", 
            headers=headers,
            params=params
        )
        
        if response.status_code == 200:
            crm_data = response.json()
            
            if crm_data and "customers" in crm_data and crm_data["customers"]:
                customer_data = crm_data["customers"][0]
                
                # Update or create customer in our database
                if local_customer:
                    # Update existing customer
                    local_customer.name = customer_data.get("name", local_customer.name)
                    local_customer.email = customer_data.get("email", local_customer.email)
                    local_customer.address = customer_data.get("address", local_customer.address)
                    local_customer.service_plan = customer_data.get("service_plan", local_customer.service_plan)
                    local_customer.account_number = customer_data.get("account_number", local_customer.account_number)
                    
                    db.session.commit()
                    logger.info(f"Updated customer {local_customer.id} with CRM data")
                    
                    return {
                        "id": local_customer.id,
                        "phone_number": local_customer.phone_number,
                        "name": local_customer.name,
                        "email": local_customer.email,
                        "address": local_customer.address,
                        "service_plan": local_customer.service_plan,
                        "account_number": local_customer.account_number
                    }
                else:
                    # Create new customer
                    new_customer = Customer(
                        phone_number=phone_number,
                        name=customer_data.get("name"),
                        email=customer_data.get("email"),
                        address=customer_data.get("address"),
                        service_plan=customer_data.get("service_plan"),
                        account_number=customer_data.get("account_number"),
                        created_at=datetime.utcnow()
                    )
                    
                    db.session.add(new_customer)
                    db.session.commit()
                    logger.info(f"Created new customer {new_customer.id} from CRM data")
                    
                    return {
                        "id": new_customer.id,
                        "phone_number": new_customer.phone_number,
                        "name": new_customer.name,
                        "email": new_customer.email,
                        "address": new_customer.address,
                        "service_plan": new_customer.service_plan,
                        "account_number": new_customer.account_number
                    }
        
        logger.warning(f"Customer not found in CRM: {phone_number}")
        return None
        
    except Exception as e:
        logger.error(f"Error searching customer in CRM: {str(e)}")
        return None
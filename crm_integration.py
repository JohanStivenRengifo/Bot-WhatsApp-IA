import os
import logging
import requests
import json
from datetime import datetime

from app import db
from models import Customer

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# CRM API configuration
CRM_API_URL = os.environ.get("CRM_API_URL")
CRM_API_KEY = os.environ.get("CRM_API_KEY")

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
                    logger.info(f"Created new customer with CRM data: {new_customer.id}")
                    
                    return {
                        "id": new_customer.id,
                        "phone_number": new_customer.phone_number,
                        "name": new_customer.name,
                        "email": new_customer.email,
                        "address": new_customer.address,
                        "service_plan": new_customer.service_plan,
                        "account_number": new_customer.account_number
                    }
        
        logger.warning(f"Customer not found in CRM or API error: {response.status_code}")
        return None
    
    except Exception as e:
        logger.error(f"Error searching for customer in CRM: {str(e)}")
        return None

def update_customer_in_crm(customer_id, data):
    """
    Update customer data in the CRM
    Returns success status
    """
    try:
        if not CRM_API_URL or not CRM_API_KEY:
            logger.warning("CRM API not configured, skipping update")
            return False
        
        # Get customer from our database
        customer = Customer.query.get(customer_id)
        if not customer or not customer.account_number:
            logger.warning(f"Cannot update CRM: Customer {customer_id} not found or missing account number")
            return False
        
        # Prepare headers
        headers = {
            "Authorization": f"Bearer {CRM_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Prepare payload
        payload = {
            "account_number": customer.account_number
        }
        
        # Add fields to update
        if "name" in data:
            payload["name"] = data["name"]
        if "email" in data:
            payload["email"] = data["email"]
        if "address" in data:
            payload["address"] = data["address"]
        if "phone_number" in data:
            payload["phone"] = data["phone_number"]
        
        # Send update request
        response = requests.put(
            f"{CRM_API_URL}/customers/{customer.account_number}",
            headers=headers,
            json=payload
        )
        
        if response.status_code in [200, 201, 204]:
            logger.info(f"Successfully updated customer {customer_id} in CRM")
            
            # Update local database as well
            if "name" in data:
                customer.name = data["name"]
            if "email" in data:
                customer.email = data["email"]
            if "address" in data:
                customer.address = data["address"]
            if "phone_number" in data:
                customer.phone_number = data["phone_number"]
            
            db.session.commit()
            return True
        else:
            logger.error(f"Failed to update customer in CRM: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"Error updating customer in CRM: {str(e)}")
        return False

def get_customer_service_history(customer_id):
    """
    Get customer service history from the CRM
    Returns list of service records
    """
    try:
        if not CRM_API_URL or not CRM_API_KEY:
            logger.warning("CRM API not configured, skipping service history lookup")
            return []
        
        # Get customer from our database
        customer = Customer.query.get(customer_id)
        if not customer or not customer.account_number:
            logger.warning(f"Cannot get service history: Customer {customer_id} not found or missing account number")
            return []
        
        # Prepare headers
        headers = {
            "Authorization": f"Bearer {CRM_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Request service history
        response = requests.get(
            f"{CRM_API_URL}/customers/{customer.account_number}/service-history",
            headers=headers
        )
        
        if response.status_code == 200:
            history_data = response.json()
            
            if "service_records" in history_data:
                logger.info(f"Retrieved {len(history_data['service_records'])} service records for customer {customer_id}")
                return history_data["service_records"]
            else:
                logger.warning(f"No service records found for customer {customer_id}")
                return []
        else:
            logger.error(f"Failed to get service history: {response.status_code} - {response.text}")
            return []
    
    except Exception as e:
        logger.error(f"Error getting customer service history: {str(e)}")
        return []

def get_customer_billing_info(customer_id):
    """
    Get customer billing information from the CRM
    Returns billing data
    """
    try:
        if not CRM_API_URL or not CRM_API_KEY:
            logger.warning("CRM API not configured, skipping billing info lookup")
            return None
        
        # Get customer from our database
        customer = Customer.query.get(customer_id)
        if not customer or not customer.account_number:
            logger.warning(f"Cannot get billing info: Customer {customer_id} not found or missing account number")
            return None
        
        # Prepare headers
        headers = {
            "Authorization": f"Bearer {CRM_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Request billing information
        response = requests.get(
            f"{CRM_API_URL}/customers/{customer.account_number}/billing",
            headers=headers
        )
        
        if response.status_code == 200:
            billing_data = response.json()
            logger.info(f"Retrieved billing info for customer {customer_id}")
            return billing_data
        else:
            logger.error(f"Failed to get billing info: {response.status_code} - {response.text}")
            return None
    
    except Exception as e:
        logger.error(f"Error getting customer billing info: {str(e)}")
        return None

def get_service_outages():
    """
    Get current service outages from the CRM
    Returns list of outage records
    """
    try:
        if not CRM_API_URL or not CRM_API_KEY:
            logger.warning("CRM API not configured, skipping outages lookup")
            return []
        
        # Prepare headers
        headers = {
            "Authorization": f"Bearer {CRM_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Request outage information
        response = requests.get(
            f"{CRM_API_URL}/service/outages",
            headers=headers
        )
        
        if response.status_code == 200:
            outage_data = response.json()
            
            if "outages" in outage_data:
                logger.info(f"Retrieved {len(outage_data['outages'])} outage records")
                return outage_data["outages"]
            else:
                logger.warning("No outage records found")
                return []
        else:
            logger.error(f"Failed to get outages: {response.status_code} - {response.text}")
            return []
    
    except Exception as e:
        logger.error(f"Error getting service outages: {str(e)}")
        return []

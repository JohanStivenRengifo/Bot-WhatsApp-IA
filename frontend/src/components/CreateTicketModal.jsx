import React, { useState } from 'react';
import axios from 'axios';

function CreateTicketModal({ onClose, onTicketCreated }) {
  const [loading, setLoading] = useState(false);
  const [customerSearchResult, setCustomerSearchResult] = useState(null);
  const [formData, setFormData] = useState({
    customer_phone: '',
    issue_type: '',
    description: '',
    priority: 'medium'
  });

  const searchCustomer = async () => {
    if (!formData.customer_phone) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/api/customers/search?phone=${formData.customer_phone}`);
      setCustomerSearchResult(response.data);
    } catch (error) {
      console.error('Error searching customer:', error);
      setCustomerSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await axios.post('/api/tickets', formData);
      onTicketCreated();
      onClose();
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-white">Create New Ticket</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Customer Phone Number
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2"
                  placeholder="Enter phone number"
                  required
                />
                <button
                  type="button"
                  onClick={searchCustomer}
                  disabled={loading || !formData.customer_phone}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  Search
                </button>
              </div>
            </div>

            {customerSearchResult && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">Customer Found:</h3>
                <p className="text-gray-300">{customerSearchResult.name || customerSearchResult.phone_number}</p>
                {customerSearchResult.email && (
                  <p className="text-gray-300">{customerSearchResult.email}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Issue Type
              </label>
              <select
                value={formData.issue_type}
                onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
                required
              >
                <option value="">Select issue type</option>
                <option value="technical">Technical Issue</option>
                <option value="billing">Billing Issue</option>
                <option value="service">Service Request</option>
                <option value="complaint">Complaint</option>
                <option value="inquiry">General Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 h-32"
                placeholder="Describe the issue..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Create Ticket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateTicketModal;
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full shadow-2xl border border-gray-700 transform transition-all">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Crear Nuevo Ticket</h2>
              <p className="text-gray-400 text-sm">Ingrese los detalles del ticket</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors duration-200 p-1"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Número de Teléfono del Cliente
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                  placeholder="Ingrese el número de teléfono"
                  required
                />
                <button
                  type="button"
                  onClick={searchCustomer}
                  disabled={loading || !formData.customer_phone}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg disabled:opacity-50 transition-colors duration-200 font-medium shadow-lg hover:shadow-indigo-500/30 flex items-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <><i className="fas fa-search mr-2"></i> Buscar</>
                  )}
                </button>
              </div>
            </div>

            {customerSearchResult && (
              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="text-white font-medium mb-2 flex items-center">
                  <i className="fas fa-user-check text-green-500 mr-2"></i>
                  Cliente Encontrado:
                </h3>
                <p className="text-gray-300">{customerSearchResult.name || customerSearchResult.phone_number}</p>
                {customerSearchResult.email && (
                  <p className="text-gray-300 mt-1">{customerSearchResult.email}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Problema
              </label>
              <select
                value={formData.issue_type}
                onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                required
              >
                <option value="">Seleccione el tipo de problema</option>
                <option value="technical">Problema Técnico</option>
                <option value="billing">Problema de Facturación</option>
                <option value="service">Solicitud de Servicio</option>
                <option value="complaint">Queja</option>
                <option value="inquiry">Consulta General</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 min-h-[8rem] resize-y"
                placeholder="Describa el problema..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prioridad
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 transition-colors duration-200 font-medium shadow-lg hover:shadow-indigo-500/30 flex items-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>Crear Ticket</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateTicketModal;
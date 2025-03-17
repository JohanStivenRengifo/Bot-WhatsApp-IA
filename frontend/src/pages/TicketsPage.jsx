import React, { useState, useEffect } from 'react';
import axios from 'axios';

function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentTicket, setCurrentTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    customer_phone: '',
    issue_type: '',
    description: '',
    priority: 'medium'
  });
  const [customerSearchResult, setCustomerSearchResult] = useState(null);
  const [ticketNote, setTicketNote] = useState('');

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      let url = '/api/tickets';
      const params = {};
      
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      
      const response = await axios.get(url, { params });
      setTickets(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setLoading(false);
    }
  };

  const searchCustomer = async () => {
    if (!newTicket.customer_phone) return;
    
    try {
      const response = await axios.get(`/api/customers/search?phone=${newTicket.customer_phone}`);
      setCustomerSearchResult(response.data);
    } catch (error) {
      console.error('Error searching customer:', error);
      setCustomerSearchResult(null);
    }
  };

  const createTicket = async () => {
    try {
      const response = await axios.post('/api/tickets', {
        customer_phone: newTicket.customer_phone,
        issue_type: newTicket.issue_type,
        description: newTicket.description,
        priority: newTicket.priority
      });
      
      // Reset form and close modal
      setNewTicket({
        customer_phone: '',
        issue_type: '',
        description: '',
        priority: 'medium'
      });
      setCustomerSearchResult(null);
      setShowCreateModal(false);
      
      // Reload tickets
      loadTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const viewTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`/api/tickets/${ticketId}`);
      setCurrentTicket(response.data);
      setShowTicketModal(true);
    } catch (error) {
      console.error('Error loading ticket details:', error);
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await axios.put(`/api/tickets/${ticketId}/status`, { status: newStatus });
      
      // Update current ticket if open in modal
      if (currentTicket && currentTicket.id === ticketId) {
        setCurrentTicket({ ...currentTicket, status: newStatus });
      }
      
      // Reload tickets
      loadTickets();
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const addTicketNote = async () => {
    if (!currentTicket || !ticketNote) return;
    
    try {
      await axios.post(`/api/tickets/${currentTicket.id}/notes`, { content: ticketNote });
      
      // Refresh ticket details
      const response = await axios.get(`/api/tickets/${currentTicket.id}`);
      setCurrentTicket(response.data);
      
      // Clear note input
      setTicketNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fas fa-ticket-alt text-yellow-500 mr-2"></i>
          Gestión de Tickets
        </h1>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <i className="fas fa-plus mr-2"></i> Nuevo Ticket
          </button>
          
          <div className="flex space-x-4">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
            >
              <option value="">Todos los estados</option>
              <option value="open">Abiertos</option>
              <option value="in_progress">En progreso</option>
              <option value="closed">Cerrados</option>
            </select>
            
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
            >
              <option value="">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            
            <button 
              onClick={loadTickets}
              className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-md"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Problema</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Prioridad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tickets.length > 0 ? (
                  tickets.map(ticket => (
                    <tr key={ticket.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">#{ticket.ticket_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{ticket.customer_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">{ticket.issue_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          ticket.status === 'open' ? 'bg-red-900 text-red-300' :
                          ticket.status === 'in_progress' ? 'bg-blue-900 text-blue-300' :
                          'bg-green-900 text-green-300'
                        }`}>
                          {ticket.status === 'open' ? 'Abierto' :
                           ticket.status === 'in_progress' ? 'En Progreso' :
                           'Cerrado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          ticket.priority === 'high' ? 'bg-red-900 text-red-300' :
                          ticket.priority === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-green-900 text-green-300'
                        }`}>
                          {ticket.priority === 'high' ? 'Alta' :
                           ticket.priority === 'medium' ? 'Media' :
                           'Baja'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => viewTicketDetails(ticket.id)}
                          className="text-primary-400 hover:text-primary-300 mr-3"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {ticket.status === 'open' && (
                          <button 
                            onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                            className="text-blue-400 hover:text-blue-300 mr-3"
                            title="Marcar en progreso"
                          >
                            <i className="fas fa-play"></i>
                          </button>
                        )}
                        {ticket.status === 'in_progress' && (
                          <button 
                            onClick={() => updateTicketStatus(ticket.id, 'closed')}
                            className="text-green-400 hover:text-green-300 mr-3"
                            title="Marcar como cerrado"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-400">
                      No se encontraron tickets con los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {showTicketModal && currentTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">
                  Ticket #{currentTicket.ticket_number}
                </h2>
                <button 
                  onClick={() => setShowTicketModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">Información del Ticket</h3>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="mb-3">
                      <span className="text-gray-400 block text-sm">Estado:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        currentTicket.status === 'open' ? 'bg-red-900 text-red-300' :
                        currentTicket.status === 'in_progress' ? 'bg-blue-900 text-blue-300' :
                        'bg-green-900 text-green-300'
                      }`}>
                        {currentTicket.status === 'open' ? 'Abierto' :
                         currentTicket.status === 'in_progress' ? 'En Progreso' :
                         'Cerrado'}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-gray-400 block text-sm">Tipo de Problema:</span>
                      <span className="text-white">{currentTicket.issue_type}</span>
                    </div>
                    <div className="mb-3">
                      <span className="text-gray-400 block text-sm">Prioridad:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        currentTicket.priority === 'high' ? 'bg-red-900 text-red-300' :
                        currentTicket.priority === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-green-900 text-green-300'
                      }`}>
                        {currentTicket.priority === 'high' ? 'Alta' :
                         currentTicket
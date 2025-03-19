import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import axios from 'axios';
import BotCrmIntegration from '../components/BotCrmIntegration';

function CrmPage() {
  return (
    <Routes>
      <Route index element={<CustomerList />} />
      <Route path="customer/:customerId" element={<CustomerDetail />} />
    </Routes>
  );
}

function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone_number: '',
    email: '',
    address: '',
    service_plan: '',
    account_number: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, [pagination.currentPage, searchTerm]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/crm/customers', {
        params: {
          page: pagination.currentPage,
          per_page: 10,
          search: searchTerm
        }
      });
      
      setCustomers(response.data.customers);
      setPagination({
        currentPage: response.data.current_page,
        totalPages: response.data.pages,
        totalItems: response.data.total
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, currentPage: 1 });
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination({ ...pagination, currentPage: newPage });
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/crm/customers', newCustomer);
      setShowCreateModal(false);
      setNewCustomer({
        name: '',
        phone_number: '',
        email: '',
        address: '',
        service_plan: '',
        account_number: ''
      });
      fetchCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
      alert(error.response?.data?.error || 'Error creating customer');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fas fa-users text-blue-500 mr-2"></i>
          CRM - Gestión de Clientes
        </h1>
        <p className="text-gray-300">
          Administra la información de tus clientes y visualiza su historial de interacciones.
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
          <form onSubmit={handleSearch} className="w-full md:w-auto mb-4 md:mb-0">
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, teléfono o email"
                className="w-full bg-gray-700 text-white rounded-l-lg px-4 py-2 border border-gray-600"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg"
              >
                <i className="fas fa-search"></i>
              </button>
            </div>
          </form>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <i className="fas fa-plus mr-2"></i> Nuevo Cliente
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Plan de Servicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Última Interacción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {customers.length > 0 ? (
                    customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{customer.name || 'Sin nombre'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{customer.phone_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{customer.email || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{customer.service_plan || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">
                            {customer.last_interaction ? new Date(customer.last_interaction).toLocaleString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => navigate(`/crm/customer/${customer.id}`)}
                            className="text-blue-400 hover:text-blue-300 mr-3"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-300">
                        No se encontraron clientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <nav className="flex items-center">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-1 rounded-md mr-2 bg-gray-700 text-gray-300 disabled:opacity-50"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <span className="text-gray-300">
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="px-3 py-1 rounded-md ml-2 bg-gray-700 text-gray-300 disabled:opacity-50"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Crear Nuevo Cliente</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Teléfono *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.phone_number}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone_number: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Número de teléfono"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Nombre completo"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Correo electrónico"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Dirección</label>
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Dirección"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Plan de Servicio</label>
                <input
                  type="text"
                  value={newCustomer.service_plan}
                  onChange={(e) => setNewCustomer({ ...newCustomer, service_plan: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Plan de servicio"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={newCustomer.account_number}
                  onChange={(e) => setNewCustomer({ ...newCustomer, account_number: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  placeholder="Número de cuenta"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg mr-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerDetail() {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState(null);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationPagination, setConversationPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
  });
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomerDetails();
  }, [customerId]);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/crm/customers/${customerId}`);
      setCustomer(response.data.customer);
      setEditedCustomer(response.data.customer);
      setConversations(response.data.recent_conversations);
      setTickets(response.data.recent_tickets);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching customer details:', error);
      setLoading(false);
    }
  };

  const fetchMoreConversations = async () => {
    try {
      setConversationLoading(true);
      const response = await axios.get(`/api/crm/customers/${customerId}/conversations`, {
        params: {
          page: conversationPage,
          per_page: 10
        }
      });
      
      setConversations(response.data.conversations);
      setConversationPagination({
        currentPage: response.data.current_page,
        totalPages: response.data.pages,
        totalItems: response.data.total
      });
      setConversationLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversationLoading(false);
    }
  };

  const handleConversationPageChange = (newPage) => {
    if (newPage > 0 && newPage <= conversationPagination.totalPages) {
      setConversationPage(newPage);
    }
  };

  const viewConversationMessages = async (conversationId) => {
    try {
      const response = await axios.get(`/api/crm/conversations/${conversationId}/messages`);
      setSelectedConversation(response.data);
      setConversationMessages(response.data.messages);
      setShowMessagesModal(true);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
    }
  };

  const handleEditToggle = () => {
    if (editing) {
      // Cancel edit
      setEditedCustomer(customer);
    }
    setEditing(!editing);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedCustomer({
      ...editedCustomer,
      [name]: value
    });
  };

  const handleSaveCustomer = async () => {
    try {
      await axios.put(`/api/crm/customers/${customerId}`, editedCustomer);
      setCustomer(editedCustomer);
      setEditing(false);
      alert('Cliente actualizado correctamente');
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Error al actualizar el cliente');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/crm')} 
            className="text-blue-400 hover:text-blue-300 mr-2"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-3xl font-bold text-white">
            {customer.name || 'Cliente sin nombre'}
          </h1>
        </div>
        <p className="text-gray-300 mt-1">{customer.phone_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                <i className="fas fa-user text-blue-500 mr-2"></i>
                Información del Cliente
              </h2>
              <button
                onClick={handleEditToggle}
                className={`text-sm px-3 py-1 rounded ${editing ? 'bg-gray-600 text-white' : 'bg-blue-600 text-white'}`}
              >
                {editing ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="name"
                    value={editedCustomer.name || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editedCustomer.email || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Dirección</label>
                  <input
                    type="text"
                    name="address"
                    value={editedCustomer.address || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Plan de Servicio</label>
                  <input
                    type="text"
                    name="service_plan"
                    value={editedCustomer.service_plan || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    name="account_number"
                    value={editedCustomer.account_number || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveCustomer}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400">Email:</span>
                  <p className="text-white">{customer.email || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Dirección:</span>
                  <p className="text-white">{customer.address || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Plan de Servicio:</span>
                  <p className="text-white">{customer.service_plan || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Número de Cuenta:</span>
                  <p className="text-white">{customer.account_number || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Fecha de Registro:</span>
                  <p className="text-white">{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Última Interacción:</span>
                  <p className="text-white">{customer.last_interaction ? new Date(customer.last_interaction).toLocaleString() : '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bot Integration */}
        <div className="lg:col-span-2">
          {/* Bot CRM Integration */}
          <BotCrmIntegration customer={customer} />
          
          {/* Conversations and Tickets */}
          {/* Recent Conversations */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                <i className="fas fa-comments text-green-500 mr-2"></i>
                Conversaciones Recientes
              </h2>
              <button
                onClick={fetchMoreConversations}
                className="text-sm px-3 py-1 rounded bg-blue-600 text-white"
              >
                Ver Todas
              </button>
            </div>

            {conversations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Fecha de Inicio
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {conversations.map((conversation) => (
                      <tr key={conversation.id} className="hover:bg-gray-700">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm text-gray-300">
                            {new Date(conversation.started_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${conversation.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                            {conversation.status === 'active' ? 'Activa' : 'Finalizada'}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => viewConversationMessages(conversation.id)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-300 text-center py-4">No hay conversaciones registradas</p>
            )}

            {conversationPagination.totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <nav className="flex items-center">
                  <button
                    onClick={() => handleConversationPageChange(conversationPagination.currentPage - 1)}
                    disabled={conversationPagination.currentPage === 1}
                    className="px-3 py-1 rounded-md mr-2 bg-gray-700 text-gray-300 disabled:opacity-50"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <span className="text-gray-300">
                    Página {conversationPagination.currentPage} de {conversationPagination.totalPages}
                  </span>
                  <button
                    onClick={() => handleConversationPageChange(conversationPagination.currentPage + 1)}
                    disabled={conversationPagination.currentPage === conversationPagination.totalPages}
                    className="px-3 py-1 rounded-md ml-2 bg-gray-700 text-gray-300 disabled:opacity-50"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </nav>
              </div>
            )}
          </div>

          {/* Conversation Messages Modal */}
          {showMessagesModal && selectedConversation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white">Mensajes de la Conversación</h3>
                  <button
                    onClick={() => setShowMessagesModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                <div className="space-y-4">
                  {conversationMessages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`p-3 rounded-lg ${message.direction === 'incoming' ? 'bg-gray-700 mr-12' : 'bg-blue-900 ml-12'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-gray-400">
                          {message.direction === 'incoming' ? 'Cliente' : 'Bot'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(message.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-white">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CrmPage;
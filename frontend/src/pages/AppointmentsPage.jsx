import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, parseISO, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { es } from 'date-fns/locale';

function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const [newAppointment, setNewAppointment] = useState({
    customer_phone: '',
    ticket_id: '',
    technician_name: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });
  const [customerSearchResult, setCustomerSearchResult] = useState(null);
  const [availableTickets, setAvailableTickets] = useState([]);

  useEffect(() => {
    loadAppointments();
  }, [statusFilter, dateFilter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      let url = '/api/appointments';
      const params = {};
      
      if (statusFilter) params.status = statusFilter;
      
      // Apply date filtering
      const today = new Date();
      if (dateFilter === 'today') {
        params.date_from = format(today, 'yyyy-MM-dd');
        params.date_to = format(today, 'yyyy-MM-dd');
      } else if (dateFilter === 'week') {
        params.date_from = format(today, 'yyyy-MM-dd');
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        params.date_to = format(nextWeek, 'yyyy-MM-dd');
      } else if (dateFilter === 'month') {
        params.date_from = format(today, 'yyyy-MM-dd');
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        params.date_to = format(nextMonth, 'yyyy-MM-dd');
      }
      
      const response = await axios.get(url, { params });
      setAppointments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setLoading(false);
    }
  };

  const searchCustomer = async () => {
    if (!newAppointment.customer_phone) return;
    
    try {
      const response = await axios.get(`/api/customers/search?phone=${newAppointment.customer_phone}`);
      setCustomerSearchResult(response.data);
      
      // If customer found, load their open tickets
      if (response.data && response.data.id) {
        loadCustomerTickets(response.data.id);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      setCustomerSearchResult(null);
      setAvailableTickets([]);
    }
  };

  const loadCustomerTickets = async (customerId) => {
    try {
      const response = await axios.get(`/api/tickets?customer_id=${customerId}&status=open,in_progress`);
      setAvailableTickets(response.data);
    } catch (error) {
      console.error('Error loading customer tickets:', error);
      setAvailableTickets([]);
    }
  };

  const createAppointment = async () => {
    try {
      const response = await axios.post('/api/appointments', {
        customer_phone: newAppointment.customer_phone,
        ticket_id: newAppointment.ticket_id || null,
        technician_name: newAppointment.technician_name,
        appointment_date: newAppointment.appointment_date,
        appointment_time: newAppointment.appointment_time,
        notes: newAppointment.notes
      });
      
      // Reset form and close modal
      setNewAppointment({
        customer_phone: '',
        ticket_id: '',
        technician_name: '',
        appointment_date: '',
        appointment_time: '',
        notes: ''
      });
      setCustomerSearchResult(null);
      setAvailableTickets([]);
      setShowCreateModal(false);
      
      // Reload appointments
      loadAppointments();
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const viewAppointmentDetails = async (appointmentId) => {
    try {
      const response = await axios.get(`/api/appointments/${appointmentId}`);
      setCurrentAppointment(response.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error loading appointment details:', error);
    }
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      await axios.put(`/api/appointments/${appointmentId}/status`, { status: newStatus });
      
      // Update current appointment if open in modal
      if (currentAppointment && currentAppointment.id === appointmentId) {
        setCurrentAppointment({ ...currentAppointment, status: newStatus });
      }
      
      // Reload appointments
      loadAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fas fa-calendar-alt text-purple-500 mr-2"></i>
          Gestión de Citas
        </h1>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <i className="fas fa-plus mr-2"></i> Nueva Cita
          </button>
          
          <div className="flex space-x-4">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
            >
              <option value="">Todos los estados</option>
              <option value="scheduled">Programadas</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
            
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
            </select>
            
            <button 
              onClick={loadAppointments}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Técnico</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {appointments.length > 0 ? (
                  appointments.map(appointment => (
                    <tr key={appointment.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{appointment.customer_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {format(new Date(appointment.appointment_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{appointment.appointment_time}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {appointment.technician_name || 'Sin asignar'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          appointment.status === 'scheduled' ? 'bg-purple-900 text-purple-300' :
                          appointment.status === 'completed' ? 'bg-green-900 text-green-300' :
                          'bg-red-900 text-red-300'
                        }`}>
                          {appointment.status === 'scheduled' ? 'Programada' :
                           appointment.status === 'completed' ? 'Completada' :
                           'Cancelada'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {appointment.ticket_number ? `#${appointment.ticket_number}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => viewAppointmentDetails(appointment.id)}
                          className="text-primary-400 hover:text-primary-300 mr-3"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {appointment.status === 'scheduled' && (
                          <>
                            <button 
                              onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                              className="text-green-400 hover:text-green-300 mr-3"
                              title="Marcar como completada"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button 
                              onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                              className="text-red-400 hover:text-red-300"
                              title="Cancelar cita"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-400">
                      No se encontraron citas con los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Appointment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-lg">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">Programar Nueva Cita</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1">Teléfono del Cliente</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={newAppointment.customer_phone}
                      onChange={(e) => setNewAppointment({...newAppointment, customer_phone: e.target.value})}
                      className="bg-gray-700 text-white rounded-l-md px-3 py-2 border border-gray-600 flex-grow"
                      placeholder="Ej: +34612345678"
                    />
                    <button
                      onClick={searchCustomer}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-r-md"
                    >
                      <i className="fas fa-search"></i>
                    </button>
                  </div>
                  {customerSearchResult && (
                    <div className="mt-2 p-2 bg-gray-700 rounded-md">
                      <p className="text-white">{customerSearchResult.name || 'Cliente sin nombre'}</p>
                      <p className="text-gray-300 text-sm">{customerSearchResult.email || 'Sin email'}</p>
                    </div>
                  )}
                </div>
                
                {customerSearchResult && (
                  <>
                    <div>
                      <label className="block text-gray-300 mb-1">Ticket Relacionado (Opcional)</label>
                      <select
                        value={newAppointment.ticket_id}
                        onChange={(e) => setNewAppointment({...newAppointment, ticket_id: e.target.value})}
                        className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 w-full"
                      >
                        <option value="">Seleccionar ticket (opcional)</option>
                        {availableTickets.map(ticket => (
                          <option key={ticket.id} value={ticket.id}>
                            #{ticket.ticket_number} - {ticket.issue_type}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-gray-300 mb-1">Técnico Asignado</label>
                      <input
                        type="text"
                        value={newAppointment.technician_name}
                        onChange={(e) => setNewAppointment({...newAppointment, technician_name: e.target.value})}
                        className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 w-full"
                        placeholder="Nombre del técnico"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-300 mb-1">Fecha</label>
                        <input
                          type="date"
                          value={newAppointment.appointment_date}
                          onChange={(e) => setNewAppointment({...newAppointment, appointment_date: e.target.value})}
                          className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-1">Hora</label>
                        <select
                          value={newAppointment.appointment_time}
                          onChange={(e) => setNewAppointment({...newAppointment, appointment_time: e.target.value})}
                          className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 w-full"
                        >
                          <option value="">Seleccionar hora</option>
                          <option value="morning">Mañana (9:00-12:00)</option>
                          <option value="afternoon">Tarde (12:00-15:00)</option>
                          <option value="evening">Tarde-Noche (15:00-18:00)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-gray-300 mb-1">Notas</label>
                      <textarea
                        value={newAppointment.notes}
                        onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                        className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 w-full"
                        rows="3"
                        placeholder="Notas adicionales sobre la cita"
                      ></textarea>
                    </div>
                  </>
                )}
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md mr-2"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createAppointment}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
                    disabled={!customerSearchResult || !newAppointment.appointment_date || !newAppointment.appointment_time}
                  >
                    Programar Cita
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {showDetailModal && currentAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-lg">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">Detalles de la Cita</h2>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="mb-3">
                    <span className="text-gray-400 block text-sm">Cliente:</span>
                    <span className="text-white">{currentAppointment.customer_name}</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-gray-400 block text-sm">Teléfono:</span>
                    <span className="text-white">{currentAppointment.customer_phone}</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-gray-400 block text-sm">Fecha y Hora:</span>
                    <span className="text-white">
                      {format(new Date(currentAppointment.appointment_date), 'dd/MM/yyyy')}, {currentAppointment.appointment_time}
                    </span>
                  </div>
                  <div className="mb-3">
                    <span className="text-gray-400 block text-sm">Técnico:</span>
                    <span className="text-white">{currentAppointment.technician_name || 'Sin asignar'}</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-gray-400 block text-sm">Estado:</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      currentAppointment.status === 'scheduled' ? 'bg-purple-900 text-purple-300' :
                      currentAppointment.status === 'completed' ? 'bg-green-900 text-green-300' :
                      'bg-red-900 text-red-300'
                    }`}>
                      {currentAppointment.status === 'scheduled' ? 'Programada' :
                       currentAppointment.status === 'completed' ? 'Completada' :
                       'Cancelada'}
                    </span>
                  </div>
                  {currentAppointment.ticket_number && (
                    <div className="mb-3">
                      <span className="text-gray-400 block text-sm">Ticket Relacionado:</span>
                      <span className="text-white">#{currentAppointment.ticket_number}</span>
                    </div>
                  )}
                  {currentAppointment.notes && (
                    <div className="mb-3">
                      <span className="text-gray-400 block text-sm">Notas:</span>
                      <p className="text-white">{currentAppointment.notes}</p>
                    </div>
                  )}
                </div>
                
                {currentAppointment.status === 'scheduled' && (
                  <div className="flex justify-between">
                    <button
                      onClick={() => updateAppointmentStatus(currentAppointment.id, 'completed')}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                    >
                      <i className="fas fa-check mr-2"></i> Marcar Completada
                    </button>
                    <button
                      onClick={() => updateAppointmentStatus(currentAppointment.id, 'cancelled')}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                    >
                      <i className="fas fa-times mr-2"></i> Cancelar Cita
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppointmentsPage;
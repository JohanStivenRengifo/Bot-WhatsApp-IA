import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function Dashboard() {
  const [stats, setStats] = useState({
    conversationsToday: 0,
    ticketsCreated: 0,
    appointmentsScheduled: 0,
    activeConversations: 0,
    systemStatus: {
      status: 'error',
      services: {
        database: { status: 'error', message: '' },
        whatsapp: { status: 'error', message: '' },
        gemini: { status: 'error', message: '' }
      }
    }
  });
  
  const [recentTickets, setRecentTickets] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch dashboard statistics
        const statsResponse = await axios.get('/api/dashboard/stats');
        setStats(statsResponse.data);
        
        // Fetch recent tickets
        const ticketsResponse = await axios.get('/api/tickets?limit=5');
        setRecentTickets(ticketsResponse.data);
        
        // Fetch recent appointments
        const appointmentsResponse = await axios.get('/api/appointments?limit=5');
        setRecentAppointments(appointmentsResponse.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // Chart data for ticket status
  const ticketStatusData = {
    labels: ['Abiertos', 'En Progreso', 'Cerrados'],
    datasets: [
      {
        data: [12, 8, 20], // Example data, should be replaced with actual data
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(75, 192, 192, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart data for conversations over time
  const conversationData = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        label: 'Conversaciones',
        data: [15, 20, 18, 25, 30, 22, 17], // Example data
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.3,
      },
    ],
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fab fa-whatsapp text-green-500 mr-2"></i>
          Bot de WhatsApp con IA para Conecta2
        </h1>
        <div className="flex justify-between items-center">
          <p className="text-gray-300">
            Sistema de atención al cliente impulsado por la IA de Google Gemini para brindar soporte automático
            a clientes de Conecta2.
          </p>
          <div 
            className={`${stats.systemStatus.status === 'ok' ? 'bg-green-500' : 'bg-red-500'} text-white px-3 py-1 rounded-full flex items-center group relative cursor-help`}
            title="Estado del Sistema"
          >
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            {stats.systemStatus.status === 'ok' ? 'Sistemas Activos' : 'Error en Sistemas'}
            
            <div className="absolute hidden group-hover:block w-64 bg-gray-900 text-sm text-white p-2 rounded-lg -bottom-32 right-0 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span>Base de Datos:</span>
                <span className={`px-2 py-1 rounded ${stats.systemStatus.services.database.status === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
                  {stats.systemStatus.services.database.status === 'ok' ? 'Conectado' : 'Error'}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span>WhatsApp API:</span>
                <span className={`px-2 py-1 rounded ${stats.systemStatus.services.whatsapp.status === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
                  {stats.systemStatus.services.whatsapp.status === 'ok' ? 'Conectado' : 'Error'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Gemini AI:</span>
                <span className={`px-2 py-1 rounded ${stats.systemStatus.services.gemini.status === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
                  {stats.systemStatus.services.gemini.status === 'ok' ? 'Conectado' : 'Error'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-primary-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-300">Conversaciones Hoy</h3>
                <i className="fas fa-comments text-2xl text-primary-500"></i>
              </div>
              <p className="text-4xl font-bold text-white">{stats.conversationsToday}</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-300">Tickets Creados</h3>
                <i className="fas fa-ticket-alt text-2xl text-yellow-500"></i>
              </div>
              <p className="text-4xl font-bold text-white">{stats.ticketsCreated}</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-300">Citas Programadas</h3>
                <i className="fas fa-calendar-alt text-2xl text-purple-500"></i>
              </div>
              <p className="text-4xl font-bold text-white">{stats.appointmentsScheduled}</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-300">Conversaciones Activas</h3>
                <i className="fas fa-headset text-2xl text-green-500"></i>
              </div>
              <p className="text-4xl font-bold text-white">{stats.activeConversations}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Estado de Tickets</h3>
              <div className="h-64">
                <Doughnut data={ticketStatusData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Conversaciones por Día</h3>
              <div className="h-64">
                <Line 
                  data={conversationData} 
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                          color: 'rgba(255, 255, 255, 0.7)'
                        }
                      },
                      x: {
                        grid: {
                          color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                          color: 'rgba(255, 255, 255, 0.7)'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
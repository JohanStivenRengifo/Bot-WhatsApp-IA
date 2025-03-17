import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title } from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [analyticsData, setAnalyticsData] = useState({
    conversationStats: {},
    ticketStats: {},
    appointmentStats: {},
    topIssues: [],
    responseTime: []
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/analytics?timeRange=${timeRange}`);
      setAnalyticsData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setLoading(false);
    }
  };

  // Conversation volume chart data
  const conversationVolumeData = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        label: 'Conversaciones',
        data: [25, 30, 45, 35, 50, 20, 15], // Example data
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.3,
      },
    ],
  };

  // Ticket status distribution chart data
  const ticketStatusData = {
    labels: ['Abiertos', 'En Progreso', 'Cerrados'],
    datasets: [
      {
        data: [15, 10, 25], // Example data
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

  // Top issues chart data
  const topIssuesData = {
    labels: ['Internet Lento', 'Sin Conexión', 'Problemas TV', 'Facturación', 'Cambio Plan'],
    datasets: [
      {
        label: 'Número de Tickets',
        data: [30, 25, 20, 15, 10], // Example data
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Response time chart data
  const responseTimeData = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        label: 'Tiempo de Respuesta (min)',
        data: [5, 3, 4, 2, 3, 4, 3], // Example data
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fas fa-chart-line text-primary-500 mr-2"></i>
          Analítica y Estadísticas
        </h1>
        <p className="text-gray-300">
          Análisis detallado del rendimiento del bot de WhatsApp y las interacciones con los clientes.
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Resumen de Actividad</h2>
          <div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600"
            >
              <option value="week">Última Semana</option>
              <option value="month">Último Mes</option>
              <option value="quarter">Último Trimestre</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-white">Conversaciones</h3>
                <i className="fas fa-comments text-primary-500 text-xl"></i>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{analyticsData.conversationStats?.total || 0}</p>
              <p className="text-sm text-gray-400">
                <span className={analyticsData.conversationStats?.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                  <i className={`fas fa-${analyticsData.conversationStats?.trend > 0 ? 'arrow-up' : 'arrow-down'} mr-1`}></i>
                  {Math.abs(analyticsData.conversationStats?.trend || 0)}%
                </span> vs periodo anterior
              </p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-white">Tickets</h3>
                <i className="fas fa-ticket-alt text-yellow-500 text-xl"></i>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{analyticsData.ticketStats?.total || 0}</p>
              <p className="text-sm text-gray-400">
                <span className={analyticsData.ticketStats?.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                  <i className={`fas fa-${analyticsData.ticketStats?.trend > 0 ? 'arrow-up' : 'arrow-down'} mr-1`}></i>
                  {Math.abs(analyticsData.ticketStats?.trend || 0)}%
                </span> vs periodo anterior
              </p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-white">Citas</h3>
                <i className="fas fa-calendar-alt text-purple-500 text-xl"></i>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{analyticsData.appointmentStats?.total || 0}</p>
              <p className="text-sm text-gray-400">
                <span className={analyticsData.appointmentStats?.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                  <i className={`fas fa-${analyticsData.appointmentStats?.trend > 0 ? 'arrow-up' : 'arrow-down'} mr-1`}></i>
                  {Math.abs(analyticsData.appointmentStats?.trend || 0)}%
                </span> vs periodo anterior
              </p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-white">Tiempo de Respuesta</h3>
                <i className="fas fa-clock text-green-500 text-xl"></i>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{analyticsData.responseTime?.average || 0} min</p>
              <p className="text-sm text-gray-400">
                <span className={analyticsData.responseTime?.trend < 0 ? 'text-green-500' : 'text-red-500'}>
                  <i className={`fas fa-${analyticsData.responseTime?.trend < 0 ? 'arrow-down' : 'arrow-up'} mr-1`}></i>
                  {Math.abs(analyticsData.responseTime?.trend || 0)}%
                </span> vs periodo anterior
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Volumen de Conversaciones</h3>
          <div className="h-64">
            <Line 
              data={conversationVolumeData} 
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
        
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Estado de Tickets</h3>
          <div className="h-64 flex items-center justify-center">
            <div className="w-3/4 h-full">
              <Doughnut 
                data={ticketStatusData} 
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                      }
                    }
                  }
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Problemas Más Comunes</h3>
          <div className="h-64">
            <Bar 
              data={topIssuesData} 
              options={{
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                  y: {
                    grid: {
                      color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                      color: 'rgba(255, 255, 255, 0.7)'
                    }
                  },
                  x: {
                    beginAtZero: true,
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
        
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Tiempo de Respuesta</h3>
          <div className="h-64">
            <Bar 
              data={responseTimeData} 
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
    </div>
  );
}

export default AnalyticsPage;
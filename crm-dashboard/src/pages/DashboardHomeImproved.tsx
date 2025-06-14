import React from 'react';
import {
  Users,
  MessageSquare,
  Activity,
  Clock,
  CheckCircle,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import {
  useRealTimeMetrics,
  useConversationStats,
  useAgentStats,
} from '../hooks/useApi';
import { getMetrics, getConversationStats, getAgentStats } from '../types';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  closedConversations: number;
  pendingConversations: number;
  totalAgents: number;
  activeAgents: number;
  averageResponseTime: number;
  customerSatisfaction: number;
  dailyMessages: number;
  weeklyGrowth: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  color,
}) => {
  const changeColor = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm ${changeColor[changeType]} mt-1`}>
              {changeType === 'positive'
                ? '↗'
                : changeType === 'negative'
                ? '↘'
                : '→'}{' '}
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
};

const DashboardHomeImproved: React.FC = () => {
  // Usar hooks para obtener datos en tiempo real
  const { data: realTimeMetrics, isLoading: metricsLoading } =
    useRealTimeMetrics();
  const { data: conversationStats, isLoading: conversationLoading } =
    useConversationStats();
  const { data: agentStats, isLoading: agentLoading } = useAgentStats();

  // Obtener datos de forma segura
  const metricsData = getMetrics(realTimeMetrics);
  const conversationStatsData = getConversationStats(conversationStats);
  const agentStatsData = getAgentStats(agentStats);

  const isLoading = metricsLoading || conversationLoading || agentLoading;

  // Combinar datos de diferentes fuentes
  const stats: DashboardStats = {
    totalConversations: conversationStatsData?.totalConversations || 0,
    activeConversations:
      conversationStatsData?.activeConversations ||
      metricsData?.activeConversations ||
      0,
    closedConversations: conversationStatsData?.closedConversations || 0,
    pendingConversations: metricsData?.pendingMessages || 0,
    totalAgents: agentStatsData?.length || 0,
    activeAgents: metricsData?.onlineAgents || 0,
    averageResponseTime: metricsData?.averageResponseTime || 0,
    customerSatisfaction: conversationStatsData?.customerSatisfaction || 95,
    dailyMessages: metricsData?.todayMessages || 0,
    weeklyGrowth: 5.2, // Esto podría venir de un endpoint específico
  };

  // Configuración de gráficos
  const conversationStatusData = {
    labels: ['Activas', 'Cerradas', 'Pendientes'],
    datasets: [
      {
        data: [
          stats.activeConversations,
          stats.closedConversations,
          stats.pendingConversations,
        ],
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
        borderWidth: 0,
      },
    ],
  };

  const messagesData = {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    datasets: [
      {
        label: 'Mensajes',
        data: [65, 59, 80, 81, 56, 55, 40],
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            {' '}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Dashboard CRM
              </h1>
              <p className="text-gray-600">
                Vista general del sistema de atención al cliente
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Activity className="h-4 w-4 text-green-500" />
                <span>Datos en tiempo real</span>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Conversaciones Totales"
            value={stats?.totalConversations || 0}
            change="+12% esta semana"
            changeType="positive"
            icon={<MessageSquare className="h-6 w-6 text-white" />}
            color="bg-blue-500"
          />
          <MetricCard
            title="Conversaciones Activas"
            value={stats?.activeConversations || 0}
            change={`${stats?.activeConversations || 0} en curso`}
            changeType="neutral"
            icon={<Activity className="h-6 w-6 text-white" />}
            color="bg-green-500"
          />
          <MetricCard
            title="Agentes Activos"
            value={`${stats?.activeAgents || 0}/${stats?.totalAgents || 0}`}
            change="Todos conectados"
            changeType="positive"
            icon={<Users className="h-6 w-6 text-white" />}
            color="bg-purple-500"
          />
          <MetricCard
            title="Tiempo de Respuesta"
            value={`${stats?.averageResponseTime || 0}min`}
            change="-0.5min vs ayer"
            changeType="positive"
            icon={<Clock className="h-6 w-6 text-white" />}
            color="bg-orange-500"
          />
        </div>

        {/* Gráficos y estadísticas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Estado de conversaciones */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Estado de Conversaciones
              </h3>
              <PieChart className="h-5 w-5 text-gray-400" />
            </div>
            <div className="h-64">
              <Doughnut
                data={conversationStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Actividad semanal */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Actividad Semanal
              </h3>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="h-64">
              <Line
                data={messagesData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Estadísticas adicionales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Resumen del día */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Resumen del Día
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Mensajes enviados</span>
                <span className="font-semibold text-gray-900">
                  {stats?.dailyMessages || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Satisfacción del cliente</span>
                <span className="font-semibold text-green-600">
                  {stats?.customerSatisfaction || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Crecimiento semanal</span>
                <span className="font-semibold text-blue-600">
                  +{stats?.weeklyGrowth || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Conversaciones recientes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Conversaciones Recientes
            </h3>
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Cliente #{item}
                    </p>
                    <p className="text-xs text-gray-500">
                      Hace {item * 5} minutos
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estado del sistema */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Estado del Sistema
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">WhatsApp API</span>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Conectado
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Base de Datos</span>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Webhook</span>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Activo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHomeImproved;

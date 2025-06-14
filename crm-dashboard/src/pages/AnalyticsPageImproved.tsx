import React from 'react';
import {
  BarChart3,
  MessageCircle,
  Users,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Activity,
} from 'lucide-react';
import {
  useConversationStats,
  useMessageStats,
  useAgentStats,
  useRealTimeMetrics,
} from '../hooks/useApi';
import {
  getMetrics,
  getConversationStats,
  getMessageStats,
  getAgentStats,
} from '../types';

const AnalyticsPageImproved: React.FC = () => {
  const {
    data: conversationStats,
    isLoading: statsLoading,
    error: statsError,
  } = useConversationStats();

  const {
    data: messageStats,
    isLoading: messageLoading,
    error: messageError,
  } = useMessageStats();

  const {
    data: agentStats,
    isLoading: agentLoading,
    error: agentError,
  } = useAgentStats();

  const { data: realTimeMetrics, isLoading: metricsLoading } =
    useRealTimeMetrics();

  const isLoading =
    statsLoading || messageLoading || agentLoading || metricsLoading;
  const hasError = statsError || messageError || agentError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="flex items-center text-red-600 mb-4">
            <AlertCircle className="mr-2" size={24} />
            <h2 className="text-xl font-semibold">Error al cargar datos</h2>
          </div>
          <p className="text-gray-600">
            No se pudieron cargar los datos analíticos. Intente nuevamente.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  // Obtener datos de forma segura usando helpers
  const conversationStatsData = getConversationStats(conversationStats);
  const messageStatsData = getMessageStats(messageStats);
  const agentStatsData = getAgentStats(agentStats);
  const realTimeMetricsData = getMetrics(realTimeMetrics);

  // Datos por defecto si no hay datos del backend
  const metrics = {
    totalConversations:
      conversationStatsData?.totalConversations ||
      realTimeMetricsData?.activeConversations ||
      0,
    activeConversations:
      conversationStatsData?.activeConversations ||
      realTimeMetricsData?.activeConversations ||
      0,
    closedConversations: conversationStatsData?.closedConversations || 0,
    pendingConversations: realTimeMetricsData?.pendingMessages || 0,
    totalMessages:
      messageStatsData?.total || realTimeMetricsData?.todayMessages || 0,
    averageResponseTime: realTimeMetricsData?.averageResponseTime || '2min',
    averageHandlingTime: conversationStatsData?.averageHandlingTime || '15min',
    customerSatisfaction: conversationStatsData?.customerSatisfaction || 85,
    agentsOnline: realTimeMetricsData?.onlineAgents || 3,
    totalAgents: agentStatsData?.length || 5,
  };
  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color = 'blue',
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<any>;
    color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-500 text-blue-100',
      green: 'bg-green-500 text-green-100',
      yellow: 'bg-yellow-500 text-yellow-100',
      purple: 'bg-purple-500 text-purple-100',
      red: 'bg-red-500 text-red-100',
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon size={24} />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-600">{title}</div>
          </div>
        </div>
        {subtitle && (
          <div className="text-sm text-gray-500 mt-2">{subtitle}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <BarChart3 className="mr-3 text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics & Reportes
            </h1>
          </div>
          <p className="text-gray-600">
            Análisis en tiempo real del rendimiento del sistema CRM
          </p>
        </div>

        {/* Estado en tiempo real */}
        {realTimeMetrics && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="text-green-500 mr-2" size={20} />
                <span className="text-sm font-medium text-gray-700">
                  Actualizado en tiempo real
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>
                  Última actualización: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Conversaciones"
            value={metrics.totalConversations}
            subtitle={`${metrics.activeConversations} activas`}
            icon={MessageCircle}
            color="blue"
          />
          <StatCard
            title="Mensajes Totales"
            value={metrics.totalMessages}
            subtitle="Enviados y recibidos"
            icon={BarChart3}
            color="green"
          />
          <StatCard
            title="Tiempo de Respuesta"
            value={metrics.averageResponseTime}
            subtitle="Promedio de agentes"
            icon={Clock}
            color="yellow"
          />
          <StatCard
            title="Satisfacción Cliente"
            value={`${metrics.customerSatisfaction}%`}
            subtitle="Calificación promedio"
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Segunda fila de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Agentes Online"
            value={`${metrics.agentsOnline}/${metrics.totalAgents}`}
            subtitle="Agentes disponibles"
            icon={Users}
            color="green"
          />
          <StatCard
            title="Tiempo de Manejo"
            value={metrics.averageHandlingTime}
            subtitle="Promedio por conversación"
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="Conversaciones Cerradas"
            value={metrics.closedConversations}
            subtitle="Exitosamente resueltas"
            icon={CheckCircle}
            color="green"
          />
        </div>

        {/* Detalles por estado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Estado de conversaciones */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Estado de Conversaciones
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Activas</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${
                          (metrics.activeConversations /
                            metrics.totalConversations) *
                            100 || 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">
                    {metrics.activeConversations}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cerradas</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${
                          (metrics.closedConversations /
                            metrics.totalConversations) *
                            100 || 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">
                    {metrics.closedConversations}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pendientes</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{
                        width: `${
                          (metrics.pendingConversations /
                            metrics.totalConversations) *
                            100 || 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">
                    {metrics.pendingConversations}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rendimiento de agentes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rendimiento de Agentes
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tiempo de Respuesta</span>
                <span className="font-medium text-green-600">
                  {metrics.averageResponseTime}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tiempo de Manejo</span>
                <span className="font-medium text-blue-600">
                  {metrics.averageHandlingTime}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Satisfacción</span>
                <span className="font-medium text-purple-600">
                  {metrics.customerSatisfaction}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Disponibilidad</span>
                <span className="font-medium text-green-600">
                  {Math.round(
                    (metrics.agentsOnline / metrics.totalAgents) * 100 || 0
                  )}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas adicionales */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen General
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(
                  (metrics.closedConversations / metrics.totalConversations) *
                    100 || 0
                ).toFixed(1)}
                %
              </div>
              <div className="text-sm text-gray-600">Tasa de Resolución</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(
                  metrics.totalMessages / metrics.totalConversations || 0
                ).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">
                Mensajes por Conversación
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {(
                  metrics.activeConversations / metrics.agentsOnline || 0
                ).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">
                Conversaciones por Agente
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {metrics.customerSatisfaction}%
              </div>
              <div className="text-sm text-gray-600">Índice de Calidad</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPageImproved;

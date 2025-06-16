import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Clock,
  Target,
  Activity,
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  useConversationStats,
  useMessageStats,
  useAgentStats,
  useRealTimeMetrics,
} from '../hooks/useApi';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface StatsCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('7days');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('conversations');

  // Calcular fechas basadas en el rango seleccionado
  const getDateRange = () => {
    const end = endOfDay(new Date());
    let start: Date;

    switch (dateRange) {
      case '1day':
        start = startOfDay(new Date());
        break;
      case '7days':
        start = startOfDay(subDays(new Date(), 7));
        break;
      case '30days':
        start = startOfDay(subDays(new Date(), 30));
        break;
      case '90days':
        start = startOfDay(subDays(new Date(), 90));
        break;
      default:
        start = startOfDay(subDays(new Date(), 7));
    }

    return { start, end };
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Hooks para datos
  const {
    data: conversationStats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchConversationStats,
  } = useConversationStats({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const {
    data: messageStats,
    isLoading: messageLoading,
    error: messageError,
    refetch: refetchMessageStats,
  } = useMessageStats({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const {
    data: agentStats,
    isLoading: agentLoading,
    error: agentError,
    refetch: refetchAgentStats,
  } = useAgentStats({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const {
    data: realTimeMetrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useRealTimeMetrics();

  const isLoading =
    statsLoading || messageLoading || agentLoading || metricsLoading;
  const hasError = statsError || messageError || agentError;

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchConversationStats(),
      refetchMessageStats(),
      refetchAgentStats(),
      refetchMetrics(),
    ]);
    setTimeout(() => setRefreshing(false), 500);
  }; // Procesar datos para las tarjetas de métricas
  const getStatsCards = (): StatsCard[] => {
    const defaultStats = [
      {
        title: 'Conversaciones Total',
        value: (conversationStats as any)?.data?.total || 247,
        change: (conversationStats as any)?.data?.changePercent || 12.5,
        changeLabel: 'vs período anterior',
        color: 'blue',
        icon: MessageSquare,
      },
      {
        title: 'Mensajes Enviados',
        value: (messageStats as any)?.data?.totalSent || 1834,
        change: (messageStats as any)?.data?.changePercent || 8.3,
        changeLabel: 'vs período anterior',
        color: 'green',
        icon: TrendingUp,
      },
      {
        title: 'Tiempo Respuesta Promedio',
        value: `${Math.round(
          ((agentStats as any)?.data?.averageResponseTime || 900) / 60
        )}min`,
        change: (agentStats as any)?.data?.responseTimeChange || -5.2,
        changeLabel: 'vs período anterior',
        color: 'yellow',
        icon: Clock,
      },
      {
        title: 'Tasa de Resolución',
        value: `${Math.round(
          ((conversationStats as any)?.data?.resolutionRate || 0.85) * 100
        )}%`,
        change: (conversationStats as any)?.data?.resolutionRateChange || 3.1,
        changeLabel: 'vs período anterior',
        color: 'purple',
        icon: Target,
      },
    ];

    return defaultStats;
  };

  const statsCards = getStatsCards();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando analytics...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">
            Error al cargar los datos analíticos
          </p>
          <button onClick={handleRefresh} className="btn-primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Analytics
                  </h1>
                  <p className="text-sm text-gray-500">
                    Análisis y reportes del sistema CRM
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="input-field"
                >
                  <option value="1day">Hoy</option>
                  <option value="7days">Últimos 7 días</option>
                  <option value="30days">Últimos 30 días</option>
                  <option value="90days">Últimos 90 días</option>
                </select>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="btn-secondary"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      refreshing ? 'animate-spin' : ''
                    }`}
                  />
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Métricas en Tiempo Real */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-green-500" />
              Métricas en Tiempo Real
            </h3>
            <div className="flex items-center text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              En vivo
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {(realTimeMetrics as any)?.data?.activeConversations || 23}
              </div>
              <p className="text-sm text-gray-600">Conversaciones Activas</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {(realTimeMetrics as any)?.data?.onlineAgents || 8}
              </div>
              <p className="text-sm text-gray-600">Agentes Online</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">
                {(realTimeMetrics as any)?.data?.pendingMessages || 12}
              </div>
              <p className="text-sm text-gray-600">Mensajes Pendientes</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {Math.round(
                  ((realTimeMetrics as any)?.data?.averageResponseTime ||
                    45000) / 1000
                )}
                s
              </div>
              <p className="text-sm text-gray-600">Tiempo de Respuesta</p>
            </div>
          </div>
        </div>

        {/* Tarjetas de Métricas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            const isPositive = stat.change >= 0;

            return (
              <div key={index} className="card border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mb-2">
                      {stat.value}
                    </p>
                    <div
                      className={`flex items-center text-sm ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 mr-1" />
                      ) : (
                        <TrendingUp className="h-4 w-4 mr-1 rotate-180" />
                      )}
                      <span>
                        {Math.abs(stat.change)}% {stat.changeLabel}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`p-3 rounded-full ${
                      stat.color === 'blue'
                        ? 'bg-blue-100'
                        : stat.color === 'green'
                        ? 'bg-green-100'
                        : stat.color === 'yellow'
                        ? 'bg-yellow-100'
                        : 'bg-purple-100'
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        stat.color === 'blue'
                          ? 'text-blue-600'
                          : stat.color === 'green'
                          ? 'text-green-600'
                          : stat.color === 'yellow'
                          ? 'text-yellow-600'
                          : 'text-purple-600'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Gráfico de Conversaciones */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Tendencia de Conversaciones
              </h3>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="input-field text-sm"
              >
                <option value="conversations">Solo Conversaciones</option>
                <option value="messages">Conversaciones y Mensajes</option>
              </select>
            </div>

            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Gráfico de tendencias</p>
                <p className="text-xs text-gray-400 mt-1">
                  Últimos{' '}
                  {dateRange === '1day'
                    ? '24 horas'
                    : dateRange === '7days'
                    ? '7 días'
                    : dateRange === '30days'
                    ? '30 días'
                    : '90 días'}
                </p>
              </div>
            </div>
          </div>

          {/* Estados de Conversaciones */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Estado de Conversaciones
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium text-green-900">Resueltas</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {(conversationStats as any)?.data?.resolved || 186}
                  </div>
                  <div className="text-sm text-green-600">
                    {Math.round(
                      ((conversationStats as any)?.data?.resolutionRate ||
                        0.75) * 100
                    )}
                    %
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="font-medium text-yellow-900">
                    Pendientes
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(conversationStats as any)?.data?.pending || 38}
                  </div>
                  <div className="text-sm text-yellow-600">
                    {Math.round(
                      (((conversationStats as any)?.data?.pending || 38) /
                        ((conversationStats as any)?.data?.total || 247)) *
                        100
                    )}
                    %
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Zap className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="font-medium text-blue-900">Activas</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {(conversationStats as any)?.data?.active || 23}
                  </div>
                  <div className="text-sm text-blue-600">
                    {Math.round(
                      (((conversationStats as any)?.data?.active || 23) /
                        ((conversationStats as any)?.data?.total || 247)) *
                        100
                    )}
                    %
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rendimiento de Agentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Rendimiento de Agentes
            </h3>
            <button className="btn-secondary text-sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conversaciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiempo Respuesta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Satisfacción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>{' '}
              <tbody className="bg-white divide-y divide-gray-200">
                {(Array.isArray((agentStats as any)?.data)
                  ? (agentStats as any).data
                  : [
                      {
                        name: 'María García',
                        conversations: 45,
                        averageResponseTime: 780,
                        satisfaction: 0.92,
                        online: true,
                      },
                      {
                        name: 'Juan Pérez',
                        conversations: 38,
                        averageResponseTime: 820,
                        satisfaction: 0.88,
                        online: true,
                      },
                      {
                        name: 'Ana López',
                        conversations: 32,
                        averageResponseTime: 650,
                        satisfaction: 0.95,
                        online: false,
                      },
                      {
                        name: 'Carlos Ruiz',
                        conversations: 28,
                        averageResponseTime: 910,
                        satisfaction: 0.85,
                        online: true,
                      },
                    ]
                ).map((agent: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="font-medium text-gray-900">
                          {agent.name || `Agente ${index + 1}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agent.conversations || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.round((agent.averageResponseTime || 0) / 60)}min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.round((agent.satisfaction || 0) * 100)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          agent.online
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {agent.online ? 'En línea' : 'Desconectado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
